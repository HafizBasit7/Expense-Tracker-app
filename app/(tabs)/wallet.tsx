import Loading from '@/components/Loading'
import ScreenWrapper from '@/components/ScreenWrapper'
import Typo from '@/components/Typo'
import WalletListItem from '@/components/WalletListItem'
import { colors, radius, spacingX, spacingY } from '@/constants/theme'
import { useAuth } from '@/contexts/authContext'
import useFetchData from '@/hooks/useFetchData'
import { WalletType } from '@/types'
import { verticalScale } from '@/utils/styling'
import { useRouter } from 'expo-router'
import { orderBy, where } from 'firebase/firestore'
import * as Icons from "phosphor-react-native"
import React from 'react'
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native'

const Wallet = () => {
  const router = useRouter();
  const {user} = useAuth();

  const {data: wallets, error, loading} = useFetchData<WalletType>("wallets", [
    where("uid", "==", user?.uid),
    orderBy("created", "desc"),
  ]);

  console.log('wallets', wallets.length);

  const getTotalBalance = () => 
    wallets.reduce((total, item)=> {
      total = total + (item.amount || 0);
      return total;
    }, 0);

  return (
    <ScreenWrapper style={{backgroundColor: colors.black}}>
      <View style={styles.container}>
        {/* Balance View */}
        <View style={styles.balanceView}>
            <View style={{alignItems: "center"}}>
              <Typo size={45} fontWeight={"500"}>
                PKR: {getTotalBalance()?.toFixed(2)}
              </Typo>
              <Typo size={16} color={colors.neutral300}>
                Total Balance
              </Typo>
            </View>
        </View>

        {/* Wallets */}
        <View style={styles.wallets}>
           {/* header */}
           <View style={styles.flexRow}>
              <Typo size={20} fontWeight={"500"} color={colors.white}>My Wallets</Typo>
              <TouchableOpacity onPress={()=> router.push("/(modals)/walletModal")}>
                <Icons.PlusCircle
                  weight='fill'
                  color={colors.primary}
                  size={verticalScale(33)}
                />
              </TouchableOpacity>
           </View>

          {/* todo: wallet list */}
          {loading && <Loading />}
          <FlatList
            data={wallets}
            renderItem={({item, index}) => {
                return <WalletListItem item ={item} index= {index} router= {router} /> 
            }}
            contentContainerStyle = {styles.listStyle}

          />

        </View>
      </View>
    </ScreenWrapper>
  )
}

export default Wallet

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
  },
  balanceView: {
    height: verticalScale(160),
    backgroundColor: colors.black,
    justifyContent: "center",
    alignItems: "center"
  },
    flexRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacingY._10,
    },
    wallets: {
      flex: 1,
      backgroundColor: colors.neutral800,
      borderTopRightRadius: radius._30,
      borderTopLeftRadius: radius._30,
      padding: spacingX._20,
      paddingTop: spacingX._25,
    },
    listStyle: {
      paddingVertical: spacingY._25,
      paddingTop: spacingY._15
    },
    
})