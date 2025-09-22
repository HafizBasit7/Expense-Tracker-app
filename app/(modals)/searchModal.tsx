import BackButton from '@/components/BackButton'
import Header from '@/components/Header'
import Input from '@/components/Input'
import ModalWrapper from '@/components/ModalWrapper'
import TransactionList from '@/components/TransactionList'
import { colors, spacingY } from '@/constants/theme'
import { useAuth } from '@/contexts/authContext'
import useFetchData from '@/hooks/useFetchData'
import { TransactionType } from '@/types'
import { useRouter } from 'expo-router'
import { orderBy, where } from 'firebase/firestore'
import React, { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'

const SearchModal = () => {
    const { user, updateUserData } = useAuth();

    const [loading, setLoading] = useState(false);
    const router = useRouter()
    const [search, setSearch] = useState("")

    const constraints = [
        where("uid", "==", user?.uid),
        orderBy("date", "desc"),
       
      ];
      const {data: allTransactions, 
        error, 
        loading: transactionLoading,
    } = useFetchData<TransactionType>("transactions", constraints);
    // console.log("Total Transactions: ", allTransactions.length);
  
    
const filteredTransactions = allTransactions.filter((item)=>{
    if(search.length>1){
        if(
            item.category?.toLocaleLowerCase()?.includes(search?.toLowerCase()) ||
            item.type?.toLocaleLowerCase()?.includes(search?.toLowerCase()) ||
            item.description?.toLocaleLowerCase()?.includes(search?.toLowerCase())
        ){
            return true;
        }
        return false
    }
    return true;
})
 

  return (
    <ModalWrapper style={{backgroundColor: colors.neutral900}}>
      <View style={styles.container}>
        <Header 
            title={'Search'} 
            leftIcon={<BackButton />} 
            style={{marginBottom: spacingY._10}}
        />

        {/* Form */}
        <ScrollView contentContainerStyle= {styles.form}>
            <View style={styles.inputContainer}>
                
                <Input
                    placeholder='Shoes...'
                    value={search}
                    placeholderTextColor={colors.neutral400}
                    containerStyle={{backgroundColor: colors.neutral800}}
                    onChangeText={(value) => setSearch(value)}

                />
            </View>

            <View>
                <TransactionList
                    loading={transactionLoading}
                    data={filteredTransactions}
                    emptyListMessage='No Transaction match your keywords'
                />
            </View>

      
        </ScrollView>
      </View>
    </ModalWrapper>
  )
}

export default SearchModal

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "space-between",
        paddingHorizontal: spacingY._20
    },
   
    form: {
        gap: spacingY._30,
        marginTop: spacingY._15
    },
   
    inputContainer: {
        gap: spacingY._10,
    }
})