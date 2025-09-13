import CustomTabs from '@/components/CustomTabs'
import { colors } from '@/constants/theme'
import { verticalScale } from '@/utils/styling'
import { Tabs } from 'expo-router'
import React from 'react'
import { Platform, StyleSheet } from 'react-native'

const _layout = () => {
  return (
    <Tabs tabBar={CustomTabs} screenOptions={{ headerShown: false, tabBarStyle: {
      backgroundColor: colors.neutral800,
      borderTopColor: colors.neutral700,
      height: Platform.OS === 'ios' ? verticalScale(73) : verticalScale(55),
      }}}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="wallet" options={{ title: "Wallet" }} />
      <Tabs.Screen name="statistics" options={{ title: "Statistics" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  )
}

export default _layout

const styles = StyleSheet.create({})
