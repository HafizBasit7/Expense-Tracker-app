import BackButton from '@/components/BackButton'
import Button from '@/components/Button'
import Header from '@/components/Header'
import ImageUpload from '@/components/ImageUpload'
import Input from '@/components/Input'
import ModalWrapper from '@/components/ModalWrapper'
import Typo from '@/components/Typo'
import { expenseCategories, transactionTypes } from '@/constants/data'
import { colors, radius, spacingX, spacingY } from '@/constants/theme'
import { useAuth } from '@/contexts/authContext'
import useFetchData from '@/hooks/useFetchData'
import { createOrUpdateTransaction, deleteTransaction } from '@/services/transactionService'
import { TransactionType, WalletType } from '@/types'
import { scale, verticalScale } from '@/utils/styling'
import DateTimePicker from '@react-native-community/datetimepicker'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { orderBy, where } from 'firebase/firestore'
import * as Icons from "phosphor-react-native"
import React, { useEffect, useState } from 'react'
import { Alert, Platform, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native'
import { Dropdown } from 'react-native-element-dropdown'

const TransactionModal = () => {
  const { user } = useAuth();
  const [transaction, setTransaction] = useState<TransactionType>({
    type: "expense",
    amount: 0,
    category: "",
    date: new Date(),
    walletId: "",
    image: null
  });

  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const router = useRouter();

  const { data: wallets, error: walletError, loading: walletLoading } = useFetchData<WalletType>("wallets", [
    where("uid", "==", user?.uid),
    orderBy("created", "desc"),
  ]);

  type paramType = {
    id: string;
    type: string;
    amount: string;
    category?: string; 
    date: string;
    description?: string;
    image?: any;
    uid?: string,
    walletId: string; 
  };

  const oldTransaction: paramType = useLocalSearchParams();

  const onDateChange = (event: any, selectedDate: any) => {
    const currentDate = selectedDate || transaction.date;
    setTransaction({...transaction, date: currentDate});
    setShowDatePicker(Platform.OS == "ios" ? true : false);
  } 

  useEffect(()=>{
    if (oldTransaction?.id){
      setTransaction({
        type: "expense",
        amount: Number(oldTransaction.amount) || 0,
        description: oldTransaction.description || "",
        category: oldTransaction.category || "",
        date: oldTransaction.date ? new Date(oldTransaction.date) : new Date(),
        walletId: oldTransaction.walletId || "",
        image: oldTransaction?.image || null,
      })
    }
  },[]);

  const onSubmit = async () => {
    const {type, amount, description, category, date, walletId, image} = transaction;
    if(!walletId || !date || !amount || (type == 'expense' && !category)){
      Alert.alert("Transaction", "Please fill all the fields");
      return;
    }

    let transactionData: TransactionType = {
      type,
      amount,
      description,
      category,
      date,
      walletId,
      image: image ? image : null,
      uid: user?.uid
    }

    console.log("transaction data: ", transactionData);

    if(oldTransaction?.id) transactionData.id = oldTransaction.id;

    setLoading(true);
    const res = await createOrUpdateTransaction(transactionData);
    setLoading(false);
    if(res.success){
      router.back();
    }else{
      Alert.alert("Transaction", res.msg)
    }
  }

  const onDelete = async () => {
    if (!oldTransaction?.id) return;
    setLoading(true);
    const res = await deleteTransaction(oldTransaction?.id);
    setLoading(false);
    if (res.success) {
      router.back();
    } else {
      Alert.alert("Transaction", res.msg);
    }
  };

  const showDeleteAlert = () => {
    Alert.alert("Confirm",
      "Are you sure you want to delete this transaction?",
      [
        {
          text: "Cancel",
          onPress: () => console.log("cancel delete"),
          style: 'cancel'
        },
        {
          text: "Delete",
          onPress: () => onDelete(),
          style: 'destructive'
        }
      ]
    );
  };

  return (
    <ModalWrapper>
      <View style={styles.container}>
        <Header
          title={oldTransaction?.id ? "Update Transaction" : 'New Transaction'}
          leftIcon={<BackButton />}
          style={{ marginBottom: spacingY._10 }}
        />

        {/* Form */}
        <ScrollView contentContainerStyle={styles.form} showsHorizontalScrollIndicator={false}>

          {/* Type of Transaction */}
          <View style={styles.inputContainer}>
            <Typo size={16} color={colors.neutral200}>Type</Typo>
            {/* dropdown */}
            <Dropdown
              style={styles.dropDownContainer}
              activeColor={colors.neutral700}
              placeholderStyle={styles.dropDownPlaceholder}
              selectedTextStyle={styles.dropDownSelectedText}
              iconStyle={styles.dropDownIcon}
              data={transactionTypes}
              maxHeight={300}
              labelField="label"
              valueField="value"
              value={transaction.type}
              itemTextStyle={styles.dropDownItemText}
              itemContainerStyle={styles.dropDownItemContainer}
              containerStyle={styles.dropDownListContainer}
              onChange={item => {
                setTransaction({ ...transaction, type: item.value })
              }}
            />
          </View>

          {/* Wallet Input */}
          <View style={styles.inputContainer}>
            <Typo size={16} color={colors.neutral200}>Wallet</Typo>
            {/* dropdown */}
            <Dropdown
              style={styles.dropDownContainer}
              activeColor={colors.neutral700}
              placeholderStyle={styles.dropDownPlaceholder}
              selectedTextStyle={styles.dropDownSelectedText}
              iconStyle={styles.dropDownIcon}
              data={wallets.map((wallet) => ({
                label: `${wallet?.name} ($${wallet.amount})`,
                value: wallet?.id,
              }))}
              maxHeight={300}
              labelField="label"
              valueField="value"
              placeholder={'Select item'}
              value={transaction.walletId}
              itemTextStyle={styles.dropDownItemText}
              itemContainerStyle={styles.dropDownItemContainer}
              containerStyle={styles.dropDownListContainer}
              onChange={item => {
                setTransaction({ ...transaction, walletId: item.value || "" })
              }}
            />
          </View>

          {/* Expense Category */}
          {
            transaction.type == "expense" && (
              <View style={styles.inputContainer}>
                <Typo size={16} color={colors.neutral200}>Expense Category</Typo>
                {/* dropdown */}
                <Dropdown
                  style={styles.dropDownContainer}
                  activeColor={colors.neutral700}
                  placeholderStyle={styles.dropDownPlaceholder}
                  selectedTextStyle={styles.dropDownSelectedText}
                  iconStyle={styles.dropDownIcon}
                  data={Object.values(expenseCategories)}
                  maxHeight={300}
                  labelField="label"
                  valueField="value"
                  placeholder={'Select Category'}
                  value={transaction.category}
                  itemTextStyle={styles.dropDownItemText}
                  itemContainerStyle={styles.dropDownItemContainer}
                  containerStyle={styles.dropDownListContainer}
                  onChange={item => {
                    setTransaction({ ...transaction, category: item.value || "" })
                  }}
                />
              </View>
            )}

          {/* Date Picker */}
          <View style={styles.inputContainer}>
            <Typo size={16} color={colors.neutral200}>Date</Typo>
            {
              !showDatePicker && (
                <Pressable
                  style={styles.dateInput}
                  onPress={()=> setShowDatePicker(true)}
                >
                  <Typo size={14}>{(transaction.date as Date).toLocaleDateString()}</Typo>
                </Pressable>
              )
            }
            {
                showDatePicker && (
                  <View style={Platform.OS == 'ios' && styles.iosDatePicker}>
                    <DateTimePicker
                        themeVariant= "dark"
                        value={transaction.date as Date}
                        textColor= {colors.white}
                        mode = "date"
                        display = {Platform.OS =="ios" ? "spinner": "default" }
                        onChange={onDateChange}
                      />

                      {
                        Platform.OS == "ios" && (
                          <TouchableOpacity style={styles.datePickerButton} onPress={()=> setShowDatePicker(false)}>
                            <Typo size={15} fontWeight={"500"}>OK</Typo>
                          </TouchableOpacity>
                        )
                      }

                  </View>
                )
            }
          </View>

          {/* amount */}
          <View style={styles.inputContainer}>
                <Typo size={16} color={colors.neutral200}>Amount</Typo>
                <Input
                    keyboardType='numeric'
                    value={transaction.amount?.toString()}
                    onChangeText={(value) => setTransaction({...transaction, amount: Number(value.replace(/[^0-9]/g,""))})}
                />
            </View>
            
            {/* Description */}
            <View style={styles.inputContainer}>
                <View style={styles.flexRow}>
                <Typo size={16} color={colors.neutral200}>Description</Typo>
                <Typo size={14} color={colors.neutral500}>(Optional)</Typo>
                </View>
                <Input
                    value={transaction.description}
                    multiline
                    containerStyle={{
                      flexDirection: "row",
                      height: verticalScale(100),
                      alignItems: "flex-start",
                      paddingVertical: 15,
                    }}
                    onChangeText={(value) => setTransaction({...transaction, description: value})}
                />
            </View>

          <View style={styles.inputContainer}>
            <View style={styles.flexRow}>
                <Typo size={16} color={colors.neutral200}>Receipt</Typo>
                <Typo size={14} color={colors.neutral500}>(Optional)</Typo>
            </View>
            <ImageUpload
              file={transaction.image}
              onClear={() => setTransaction({ ...transaction, image: null })}
              onSelect={file => setTransaction({ ...transaction, image: file })}
              placeholder='Upload Image'
            />
          </View>
        </ScrollView>
      </View>

      <View style={styles.footer}>
        {
          oldTransaction?.id && !loading && (
            <Button
              onPress={showDeleteAlert}
              style={{
                backgroundColor: colors.rose,
                paddingHorizontal: spacingX._15
              }}
            >
              <Icons.Trash
                color={colors.white}
                size={verticalScale(24)}
                weight="bold"
              />
            </Button>
          )
        }
        <Button onPress={onSubmit} loading={loading} style={{ flex: 1 }}>
          <Typo color={colors.black} fontWeight={"700"}>
            {
              oldTransaction?.id ? "Update" : "Submit"
            }
          </Typo>
        </Button>
      </View>
    </ModalWrapper>
  )
}

export default TransactionModal;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacingY._20
  },
  footer: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    paddingHorizontal: spacingX._20,
    gap: scale(12),
    paddingTop: spacingY._15,
    borderTopColor: colors.neutral700,
    marginBottom: spacingY._15,
    borderTopWidth: 1
  },
  form: {
    gap: spacingY._30,
    paddingVertical: spacingY._15,
    paddingBottom: spacingY._40
  },
  iosDropDown: {
    flexDirection: "row",
    height: verticalScale(54),
    alignItems: "center",
    justifyContent: "center",
    fontSize: verticalScale(14),
    borderWidth: 1,
    color: colors.white,
    borderColor: colors.neutral300,
    borderRadius: radius._17,
    borderCurve: "continuous",
    paddingHorizontal: spacingX._15,
  },
  androidDropDown: {
    height: verticalScale(54),
    alignItems: "center",
    justifyContent: "center",
    fontSize: verticalScale(14),
    borderWidth: 1,
    color: colors.white,
    borderColor: colors.neutral300,
    borderRadius: radius._17,
    borderCurve: "continuous",
  },
  flexRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._5
  },
  dateInput: {
    flexDirection: "row",
    height: verticalScale(54),
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.neutral300,
    borderRadius: radius._17,
    borderCurve: "continuous",
    paddingHorizontal: spacingX._15
  },
  iosDatePicker: {
    // backgroundColor: "red"
  },
  datePickerButton: {
    backgroundColor: colors.neutral700,
    alignSelf: "flex-end",
    padding: spacingX._7,
    paddingHorizontal: spacingY._15,
    borderRadius: radius._10
  },
  dropDownContainer: {
    height: verticalScale(54),
    borderWidth: 1,
    borderColor: colors.neutral300,
    paddingHorizontal: spacingX._15,
    borderRadius: radius._15,
    borderCurve: "continuous",
  },
  dropDownItemText: {
    color: colors.white
  },
  dropDownSelectedText: {
    color: colors.white,
    fontSize: verticalScale(14)
  },
  dropDownListContainer: {
    backgroundColor: colors.neutral900,
    borderRadius: radius._15,
    borderCurve: "continuous",
    paddingVertical: spacingY._7,
    top: 5,
    borderColor: colors.neutral500,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 15,
    elevation: 5
  },
  dropDownPlaceholder: {
    color: colors.white,
  },
  dropDownItemContainer: {
    borderRadius: radius._15,
    marginHorizontal: spacingY._7,
  },
  dropDownIcon: {
    height: verticalScale(30),
    tintColor: colors.neutral300
  },
  inputContainer: {
    gap: spacingY._10,
  }
})