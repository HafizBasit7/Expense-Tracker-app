import { firestore } from "@/config/firebase";
import { colors } from "@/constants/theme";
import { ResponseType, TransactionType, WalletType } from "@/types";
import { getLast12Months, getLast7Days, getYearsRange } from "@/utils/common";
import { collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, setDoc, Timestamp, updateDoc, where } from "firebase/firestore";
import { uploadFileToCloudinary } from "./imageService";
import { createOrUpdateWallet } from "./walletService";

export const createOrUpdateTransaction = async (
    transactionData: Partial<TransactionType>
): Promise<ResponseType> => {
    try {
        const { id, type, walletId, amount, image, description } = transactionData;
        
        // Make description and image optional
        if (!amount || amount <= 0 || !walletId || !type) {
            return { success: false, msg: "Invalid transaction data!" };
        }

        if (id) {
            // This is an update operation
            const oldTransactionSnapshot = await getDoc(doc(firestore, "transactions", id));
            if (!oldTransactionSnapshot.exists()) {
                return { success: false, msg: "Transaction not found!" };
            }
            
            const oldTransaction = oldTransactionSnapshot.data() as TransactionType;
            const shouldRevertOriginal =
                oldTransaction.type != type ||
                oldTransaction.amount != amount ||
                oldTransaction.walletId != walletId;
                
            if (shouldRevertOriginal) {
                let res = await revertAndUpdateWallets(oldTransaction, Number(amount), type, walletId);
                if (!res.success) return res;
            }
        } else {
            // This is a create operation - update the wallet for new transaction
            let res = await updateWalletForNewTransaction(
                walletId!,
                Number(amount!),
                type!
            );
            if (!res.success) return res;
        }

        // Handle image upload if present (make it optional)
        if (image && typeof image !== 'string') {
            const imageUploadRes = await uploadFileToCloudinary(
                image,
                "transactions"
            );
            if (!imageUploadRes.success) {
                return {
                    success: false,
                    msg: imageUploadRes.msg || "Failed to upload image",
                };
            }
            transactionData.image = imageUploadRes.data;
        } else if (image === null || image === undefined) {
            // Ensure image is set to null if not provided
            transactionData.image = null;
        }

        // Ensure description is set even if empty
        transactionData.description = description || "";

        const transactionRef = id
            ? doc(firestore, "transactions", id)
            : doc(collection(firestore, "transactions"));

        // Use updateDoc for existing transactions to ensure proper updating
        if (id) {
            await updateDoc(transactionRef, transactionData as any);
        } else {
            await setDoc(transactionRef, transactionData, { merge: true });
        }

        return {
            success: true,
            data: { ...transactionData, id: transactionRef.id }
        };

    } catch (error: any) {
        console.log("error creating or updating the transaction: ", error)
        return { success: false, msg: error.message }
    }
}

export const deleteTransaction = async (transactionId: string): Promise<ResponseType> => {
    try {
        // First, get the transaction to revert wallet changes
        const transactionSnapshot = await getDoc(doc(firestore, "transactions", transactionId));
        if (!transactionSnapshot.exists()) {
            return { success: false, msg: "Transaction not found!" };
        }

        const transaction = transactionSnapshot.data() as TransactionType;
        
        // Revert wallet changes
        const revertRes = await revertWalletChanges(transaction);
        if (!revertRes.success) {
            return revertRes;
        }

        // Delete the transaction
        await deleteDoc(doc(firestore, "transactions", transactionId));

        return { success: true, msg: "Transaction deleted successfully" };
    } catch (error: any) {
        console.log("error deleting transaction: ", error);
        return { success: false, msg: error.message };
    }
};

const revertWalletChanges = async (transaction: TransactionType): Promise<ResponseType> => {
    try {
        const walletRef = doc(firestore, "wallets", transaction.walletId);
        const walletSnapshot = await getDoc(walletRef);
        
        if (!walletSnapshot.exists()) {
            return { success: false, msg: "Wallet not found" };
        }

        const walletData = walletSnapshot.data() as WalletType;
        
        const revertType = transaction.type === 'income' ? 'totalIncome' : 'totalExpenses';
        const revertAmount = transaction.type === 'income' 
            ? -Number(transaction.amount) 
            : Number(transaction.amount);

        const revertedWalletAmount = Number(walletData.amount) + revertAmount;
        const revertedTotalAmount = Number(walletData[revertType] || 0) - Number(transaction.amount);

        await updateDoc(walletRef, {
            amount: revertedWalletAmount,
            [revertType]: Math.max(0, revertedTotalAmount) // Ensure it doesn't go below 0
        });

        return { success: true };
    } catch (error: any) {
        console.log("error reverting wallet changes: ", error);
        return { success: false, msg: error.message };
    }
};

const updateWalletForNewTransaction = async (
    walletId: string,
    amount: number,
    type: string,
) => {
    try {
        const walletRef = doc(firestore, "wallets", walletId);
        const walletSnapshot = await getDoc(walletRef);
        if (!walletSnapshot.exists()) {
            console.log("error updating wallet for new transaction");
            return { success: false, msg: "wallet not found" }
        }
        
        const walletData = walletSnapshot.data() as WalletType;
        
        // Handle case where wallet might not have totalIncome/totalExpenses fields
        const currentTotalIncome = Number(walletData.totalIncome) || 0;
        const currentTotalExpenses = Number(walletData.totalExpenses) || 0;
        const currentAmount = Number(walletData.amount) || 0;
        
        if (type == "expense" && currentAmount - amount < 0) {
            return {
                success: false,
                msg: "Selected wallet doesn't have enough balance",
            };
        }

        const updateType = type == "income" ? "totalIncome" : "totalExpenses";
        const updatedWalletAmount =
            type == "income"
                ? currentAmount + amount
                : currentAmount - amount;

        const updatedTotals = type == "income"
            ? currentTotalIncome + amount
            : currentTotalExpenses + amount;

        await updateDoc(walletRef, {
            amount: updatedWalletAmount,
            [updateType]: updatedTotals
        });

        return { success: true };
    } catch (error: any) {
        console.log("error updating the wallet for new transaction: ", error)
        return { success: false, msg: error.message }
    }
}

const revertAndUpdateWallets = async (
    oldTransaction: TransactionType,
    newTransactionAmount: number,
    newTransactionType: string,
    newWalletId: string
) => {
    try {
        const originalWalletSnapshot = await getDoc(
            doc(firestore, "wallets", oldTransaction.walletId)
        );

        if (!originalWalletSnapshot.exists()) {
            return { success: false, msg: "Original wallet not found" };
        }

        const originalWallet = originalWalletSnapshot.data() as WalletType;

        let newWalletSnapshot = await getDoc(
            doc(firestore, "wallets", newWalletId)
        );
        
        if (!newWalletSnapshot.exists()) {
            return { success: false, msg: "New wallet not found" };
        }
        
        let newWallet = newWalletSnapshot.data() as WalletType;

        const revertType = oldTransaction.type == 'income' ? 'totalIncome' : "totalExpenses";
        const revertIncomeExpense: number = oldTransaction.type == 'income'
            ? -Number(oldTransaction.amount)
            : Number(oldTransaction.amount);

        // Handle potentially missing fields
        const originalWalletAmount = Number(originalWallet.amount) || 0;
        const originalWalletRevertField = Number(originalWallet[revertType]) || 0;
        
        const revertedWalletAmount = originalWalletAmount + revertIncomeExpense;
        const revertedIncomeExpenseAmount = Math.max(0, originalWalletRevertField - Number(oldTransaction.amount));

        // Check if the new transaction type is expense and validate balance
        if (newTransactionType == 'expense') {
            const newWalletCurrentAmount = Number(newWallet.amount) || 0;
            
            if (
                oldTransaction.walletId == newWalletId &&
                revertedWalletAmount < newTransactionAmount
            ) {
                return {
                    success: false,
                    msg: "The selected wallet doesn't have enough balance",
                };
            }

            if (oldTransaction.walletId != newWalletId && newWalletCurrentAmount < newTransactionAmount) {
                return {
                    success: false,
                    msg: "The selected wallet doesn't have enough balance",
                };
            }
        }

        // Revert original wallet changes
        await createOrUpdateWallet({
            id: oldTransaction.walletId,
            amount: revertedWalletAmount,
            [revertType]: revertedIncomeExpenseAmount,
        });

        // If the wallet changed, refetch the new wallet data
        if (oldTransaction.walletId !== newWalletId) {
            newWalletSnapshot = await getDoc(
                doc(firestore, "wallets", newWalletId)
            );
            newWallet = newWalletSnapshot.data() as WalletType;
        } else {
            // If same wallet, use the reverted amounts
            newWallet = {
                ...newWallet,
                amount: revertedWalletAmount,
                [revertType]: revertedIncomeExpenseAmount
            } as WalletType;
        }

        // Apply new transaction to the (possibly new) wallet
        const updateType = newTransactionType == 'income' ? "totalIncome" : 'totalExpenses';
        const updatedTransactionAmount: number =
            newTransactionType == "income"
                ? Number(newTransactionAmount)
                : -Number(newTransactionAmount);

        const newWalletCurrentAmount = Number(newWallet.amount) || 0;
        const newWalletUpdateField = Number(newWallet[updateType]) || 0;
        
        const newWalletAmount = newWalletCurrentAmount + updatedTransactionAmount;
        const newIncomeExpenseAmount = newWalletUpdateField + Number(newTransactionAmount);
        
        await createOrUpdateWallet({
            id: newWalletId,
            amount: newWalletAmount,
            [updateType]: newIncomeExpenseAmount
        });
 
        return { success: true };
    } catch (error: any) {
        console.log("error updating the wallet for transaction update: ", error)
        return { success: false, msg: error.message }
    }
}




export const fetchWeeklyStats = async (uid: string): Promise<ResponseType> => {
    try {
        const db = firestore;
        const today = new Date();
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 7);

        const transactionsQuery = query(
            collection(db, 'transactions'),
            where("uid", "==", uid),
            where("date", ">=", Timestamp.fromDate(sevenDaysAgo)),
            where("date", "<=", Timestamp.fromDate(today)),
            orderBy("date", "desc")
        )

        const querySnapshot = await getDocs(transactionsQuery)
        const weeklyData = getLast7Days();
        const transactions: TransactionType[] = [];

        // Mapping each transaction to respective day
        querySnapshot.forEach((doc) => {
            const transaction = doc.data() as TransactionType;
            transaction.id = doc.id;
            transactions.push(transaction);

            const transactionDate = (transaction.date as Timestamp)
                .toDate()
                .toISOString()
                .split("T")[0]; // Get YYYY-MM-DD format

            const dayData = weeklyData.find((day) => day.date === transactionDate);

            if (dayData) {
                if (transaction.type === "income") {
                    dayData.income += transaction.amount;
                } else if (transaction.type === "expense") {
                    dayData.expense += transaction.amount;
                } 
            }
        });
        
        // Create chart data with proper structure
        const stats = weeklyData.map((day) => ({
            label: day.day,
            stacks: [
              {
                value: day.income,
                color: colors.primary,
                marginBottom: 2,
              },
              {
                value: day.expense,
                color: colors.rose,
              },
            ],
          }));
        
        return { 
            success: true, 
            data: {
                stats, 
                transactions,
                weeklyData // Include raw data for debugging
            }
        };
    } catch (error: any) {
        console.log("error fetching weekly stats: ", error);
        return { 
            success: false, 
            msg: error.message || "Failed to fetch weekly statistics"
        };
    }
}; 

export const fetchMonthlyStats = async (uid: string): Promise<ResponseType> => {
    try {
        const db = firestore;
        const today = new Date();
        const twelveMonthsAgo = new Date(today);
        twelveMonthsAgo.setMonth(today.getMonth() - 12);

        const transactionsQuery = query(
            collection(db, 'transactions'),
            where("uid", "==", uid),
            where("date", ">=", Timestamp.fromDate(twelveMonthsAgo)),
            where("date", "<=", Timestamp.fromDate(today)),
            orderBy("date", "desc")
        )

        const querySnapshot = await getDocs(transactionsQuery)
        const monthlyData = getLast12Months();
        const transactions: TransactionType[] = [];

        // Mapping each transaction to respective month
        querySnapshot.forEach((doc) => {
            const transaction = doc.data() as TransactionType;
            transaction.id = doc.id;
            transactions.push(transaction);

            const transactionDate = (transaction.date as Timestamp).toDate();
            const monthName = transactionDate.toLocaleString("default", {
                month: "short"
            });
            const shortYear = transactionDate.getFullYear().toString().slice(-2);
            const monthKey = `${monthName} ${shortYear}`;
            
            const monthData = monthlyData.find(
                (month) => month.month === monthKey
            );
            
            if (monthData) {
                if (transaction.type === "income") {
                    monthData.income += transaction.amount;
                } else if (transaction.type === "expense") {
                    monthData.expense += transaction.amount;
                } 
            }
        });
        
        // Create chart data with proper structure
        // const stats = monthlyData.map((month) => [
        //     {
        //         value: month.income,
        //         label: month.month,
        //         spacing: scale(4),
        //         labelWidth: scale(30),
        //         frontColor: colors.primary
        //     },
        //     {
        //         value: month.expense,
        //         frontColor: colors.rose,
        //     },
        // ]);

        const stats = monthlyData.map((month) => ({
            label: month.month,
            stacks: [
              {
                value: month.income,
                color: colors.primary,
                marginBottom: 2,
              },
              {
                value: month.expense,
                color: colors.rose,
              },
            ],
          }));
        
        return { 
            success: true, 
            data: {
                stats, 
                transactions,
                monthlyData // Include raw data for debugging
            }
        };
    } catch (error: any) {
        console.log("error fetching monthly stats: ", error);
        return { 
            success: false, 
            msg: error.message || "Failed to fetch monthly statistics"
        };
    }
};

// export const fetchYearlyStats = async (uid: string): Promise<ResponseType> => {
//     try {
//         const db = firestore;

//         const transactionsQuery = query(
//             collection(db, 'transactions'),
//             where("uid", "==", uid),
//             orderBy("date", "desc")
//         )

//         const querySnapshot = await getDocs(transactionsQuery)
//         const transactions: TransactionType[] = [];

//          const firstTransaction = querySnapshot.docs.reduce((earliest, doc)=>{
//             const transactionDate = doc.data().data.toDate();
//             return transactionDate < earliest ? transactionDate: earliest;
// }, new Date());

//         const firstYear = firstTransaction.getFullYear();
//         const currentYear = new Date().getFullYear();

//         const yearlyData = getYearsRange(firstYear, currentYear);


//         // Mapping each transaction to respective year
//         querySnapshot.forEach((doc) => {
//             const transaction = doc.data() as TransactionType;
//             transaction.id = doc.id;
//             transactions.push(transaction);

//             const transactionYear = (transaction.date as Timestamp).toDate().getFullYear();
            
            
//             const yearData = yearlyData.find(
//                 (item: any) => item.year === transactionYear.toString()
//             );
            
//             if (yearData) {
//                 if (transaction.type === "income") {
//                     yearData.income += transaction.amount;
//                 } else if (transaction.type === "expense") {
//                     yearData.expense += transaction.amount;
//                 } 
//             }
//         });
        
//         // Create chart data with proper structure
//         const stats = yearlyData.flatMap((year: any) => [
//             {
//                 value: year.income,
//                 label: year.year,
//                 spacing: scale(4),
//                 labelWidth: scale(35),
//                 frontColor: colors.primary
//             },
//             {
//                 value: year.expense,
//                 frontColor: colors.rose,
//             },
//         ]);
        
//         return { 
//             success: true, 
//             data: {
//                 stats, 
//                 transactions,
//                 // yearlyData // Include raw data for debugging
//             }
//         };
//     } catch (error: any) {
//         console.log("error fetching yearly stats: ", error);
//         return { 
//             success: false, 
//             msg: error.message || "Failed to fetch yearly statistics"
//         };
//     }
// };




export const fetchYearlyStats = async (uid: string): Promise<ResponseType> => {
    try {
      const db = firestore;
  
      const transactionsQuery = query(
        collection(db, 'transactions'),
        where("uid", "==", uid),
        orderBy("date", "desc")
      );
  
      const querySnapshot = await getDocs(transactionsQuery);
      const transactions: TransactionType[] = [];
  
      // Find the earliest transaction year
      let firstYear = new Date().getFullYear(); // Default to current year
      
      if (!querySnapshot.empty) {
        const firstTransaction = querySnapshot.docs.reduce((earliest, doc) => {
          const transactionDate = doc.data().date.toDate();
          return transactionDate < earliest ? transactionDate : earliest;
        }, new Date());
        
        firstYear = firstTransaction.getFullYear();
      }
  
      const currentYear = new Date().getFullYear();
      const yearlyData = getYearsRange(firstYear, currentYear);
  
      // Initialize yearly data with 0 values
      yearlyData.forEach(year => {
        year.income = 0;
        year.expense = 0;
      });
  
      // Mapping each transaction to respective year
      querySnapshot.forEach((doc) => {
        const transaction = doc.data() as TransactionType;
        transaction.id = doc.id;
        transactions.push(transaction);
  
        const transactionYear = (transaction.date as Timestamp).toDate().getFullYear();
        const yearData = yearlyData.find(
          (item: any) => item.year === transactionYear.toString()
        );
        
        if (yearData) {
          if (transaction.type === "income") {
            yearData.income += transaction.amount;
          } else if (transaction.type === "expense") {
            yearData.expense += transaction.amount;
          } 
        }
      });
      
      // Create proper chart data structure for grouped bars
      const stats = yearlyData.map((year: any) => ({
        label: year.year,
        stacks: [
          {
            value: year.income,
            color: colors.primary,
            marginBottom: 2,
          },
          {
            value: year.expense,
            color: colors.rose,
          },
        ],
      }));
      
      return { 
        success: true, 
        data: {
          stats, 
          transactions,
          yearlyData
        }
      };
    } catch (error: any) {
      console.log("error fetching yearly stats: ", error);
      return { 
        success: false, 
        msg: error.message || "Failed to fetch yearly statistics"
      };
    }
  };