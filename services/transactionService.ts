import { firestore } from "@/config/firebase";
import { ResponseType, TransactionType, WalletType } from "@/types";
import { collection, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { uploadFileToCloudinary } from "./imageService";

export const createOrUpdateTransaction = async(
    transactionData: Partial<TransactionType>
): Promise<ResponseType> => {
    try {
        const {id, type, walletId, amount, image} = transactionData;
        if(!amount || amount <= 0 || !walletId || !type){
            return {success: false, msg: "Invalid transaction data!"};
        }

        if(id){
            // todo: update existing transaction
        }else{
            // update the wallet for new transaction
            let res = await updateWAlletForNewTransaction(
                walletId!,
                Number(amount!),
                type!
            );
            if(!res.success) return res;
        }

        if(image){
            const imageUploadRes = await uploadFileToCloudinary(
                image, 
                "transactions"
            );
            if(!imageUploadRes.success){
                return { 
                    success: false, 
                    msg: imageUploadRes.msg || "Failed to upload image",
                };
            }
            transactionData.image = imageUploadRes.data;
        }

        const transactionRef = id
            ? doc(firestore, "transactions", id)
            : doc(collection(firestore, "transactions"));

            await setDoc(transactionRef, transactionData, {merge: true});

        return {
            success: true, 
            data: {...transactionData, id: transactionRef.id}
        };
   
    } catch (error: any) {
        console.log("error creating or updating the transaction: ", error)
        return {success: false, msg: error.message}
        
    }
}

const updateWAlletForNewTransaction = async(
    walletId: string,
    amount: number,
    type: string,
)=> {
    try{
        const walletRef = doc(firestore, "wallets", walletId);
        const walletSnapshot = await getDoc(walletRef);
        if(!walletSnapshot.exists()) {
            console.log("error updating wallet for new transaction");
            return {success: false, msg: "wallet not found"}
        }
        const walletData = walletSnapshot.data() as WalletType;
         if(type == "expense" && walletData.amount! - amount < 0){
            return {
                success: false, 
                msg: "Selected wallet don't have enough balance",};
        }

        const updateType = type == "income" ? "totalIncome" : "totalExpenses";
        const updatedWalletAmount = 
            type == "income" 
            ? Number(walletData.amount) + amount
            : Number(walletData.amount) - amount;

            const updatedTotals = type == "income"
             ? Number(walletData.totalIncome) + amount
             : Number(walletData.totalExpenses) + amount;

             await updateDoc(walletRef, {
                amount: updatedWalletAmount,
                [updateType]: updatedTotals
             });

        return {success: true};
    } catch (error: any) {
        console.log("error updating the wallet for new transaction: ", error)
        return {success: false, msg: error.message}
        
    
    }

}