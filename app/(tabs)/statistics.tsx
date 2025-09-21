import Header from '@/components/Header'
import Loading from '@/components/Loading'
import ScreenWrapper from '@/components/ScreenWrapper'
import TransactionList from '@/components/TransactionList'
import { colors, radius, spacingX, spacingY } from '@/constants/theme'
import { useAuth } from '@/contexts/authContext'
import { fetchMonthlyStats, fetchWeeklyStats, fetchYearlyStats } from '@/services/transactionService'
import { scale, verticalScale } from '@/utils/styling'
import SegmentedControl from '@react-native-segmented-control/segmented-control'
import React, { useEffect, useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native'
import { BarChart } from "react-native-gifted-charts"

const Statistics = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const {user} = useAuth();
  const [chartData, setChartData] = useState([])
  const [chartLoading, setChartLoading] = useState(false);
  const [transactions, setTransactions] = useState([])
  const [statsType, setStatsType] = useState('Weekly')

  useEffect(() => {
    loadStats();
  }, [activeIndex]);

  const loadStats = async () => {
    try {
      setChartLoading(true);
      let res;
      
      if (activeIndex === 0) {
        setStatsType('Weekly');
        res = await fetchWeeklyStats(user?.uid as string);
      } else if (activeIndex === 1) {
        setStatsType('Monthly');
        res = await fetchMonthlyStats(user?.uid as string);
      } else {
        setStatsType('Yearly');
        res = await fetchYearlyStats(user?.uid as string);
      }
      
      setChartLoading(false);
      
      if (res.success) {
        setChartData(res.data?.stats || []);
        setTransactions(res.data?.transactions || []);
      } else {
        Alert.alert("Error", res.msg || "Failed to fetch statistics");
        setChartData([]);
        setTransactions([]);
      }
    } catch (error) {
      setChartLoading(false);
      console.error('Error loading stats:', error);
      Alert.alert("Error", "An unexpected error occurred");
    }
  };

  // Calculate totals for display
  const calculateTotals = () => {
    let totalIncome = 0;
    let totalExpense = 0;
    
    chartData.forEach(item => {
      if (item.stacks) {
        totalIncome += item.stacks[0]?.value || 0;
        totalExpense += item.stacks[1]?.value || 0;
      }
    });
    
    return { totalIncome, totalExpense, net: totalIncome - totalExpense };
  };

  const totals = calculateTotals();

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <View style={styles.header}>
          <Header title="Statistics" />
        </View>

        <ScrollView
          contentContainerStyle={{
            gap: spacingY._20,
            paddingTop: spacingY._5,
            paddingBottom: verticalScale(100)
          }} 
          showsVerticalScrollIndicator={false}
        >
          <SegmentedControl
            values={['Weekly', 'Monthly', 'Yearly']}
            selectedIndex={activeIndex}
            onChange={(event) => {
              setActiveIndex(event.nativeEvent.selectedSegmentIndex);
            }}
            tintColor={colors.neutral200}
            backgroundColor={colors.neutral800}
            appearance='dark'
            activeFontStyle={styles.segmentFontStyle}
            style={styles.segmentStyle}
            fontStyle={{...styles.segmentFontStyle, color: colors.white}}
          />
          
          {/* Summary Cards */}
          <View style={styles.summaryContainer}>
            <View style={[styles.summaryCard, {backgroundColor: colors.neutral800}]}>
              <Text style={styles.summaryLabel}>Income</Text>
              <Text style={[styles.summaryValue, {color: colors.primary}]}>
                Rs {totals.totalIncome.toFixed(2)}
              </Text>
            </View>
            <View style={[styles.summaryCard, {backgroundColor: colors.neutral800}]}>
              <Text style={styles.summaryLabel}>Expense</Text>
              <Text style={[styles.summaryValue, {color: colors.rose}]}>
                Rs {totals.totalExpense.toFixed(2)}
              </Text>
            </View>
            <View style={[styles.summaryCard, {backgroundColor: colors.neutral800}]}>
              <Text style={styles.summaryLabel}>Net</Text>
              <Text style={[styles.summaryValue, {color: totals.net >= 0 ? colors.primary : colors.rose}]}>
                Rs {totals.net.toFixed(2)}
              </Text>
            </View>
          </View>
          
          <View style={styles.chartContainer}>
            {chartData.length > 0 ? (
              <>
                <Text style={styles.chartTitle}>{statsType} Overview</Text>
                <BarChart
                  stackData={chartData}
                  barWidth={activeIndex === 2 ? scale(20) : scale(12)}
                  spacing={activeIndex === 0 ? scale(16) : scale(25)}
                  roundedTop
                  roundedBottom
                  hideRules
                  yAxisLabelPrefix='Rs '
                  yAxisThickness={0}
                  xAxisThickness={0}
                  yAxisLabelWidth={scale(40)}
                  yAxisTextStyle={{color: colors.neutral350, fontSize: verticalScale(10)}}
                  xAxisLabelTextStyle={{
                    color: colors.neutral350,
                    fontSize: verticalScale(activeIndex === 2 ? 9 : 11),
                    textAlign: 'center'
                  }}
                  noOfSections={3}
                  minHeight={verticalScale(200)}
                  showValuesAsTopLabel
                  topLabelTextStyle={{color: colors.neutral350, fontSize: verticalScale(9)}}
                />
              </>
            ) : (
              <View style={styles.noChart}>
                <Text style={styles.noDataText}>
                  {chartLoading ? 'Loading data...' : 'No data available'}
                </Text>
              </View>
            )}

            {chartLoading && (
              <View style={styles.chartLoadingContainer}>
                <Loading color={colors.white} />
              </View>
            )}
          </View>

          {/* Transactions */}
          <View>
            <TransactionList
              title={`Recent Transactions (${statsType})`}
              emptyListMessage='No Transactions found'
              data={transactions.slice(0, 30)} // Show only recent 10 transactions
            />
          </View>
        </ScrollView>
      </View>
    </ScreenWrapper>
  )
}

export default Statistics

const styles = StyleSheet.create({
  chartContainer: {
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.neutral900,
    borderRadius: radius._12,
    padding: spacingY._15,
    minHeight: verticalScale(250),
  },
  chartLoadingContainer: {
    position: "absolute",
    width: "100%",
    height: "100%",
    borderRadius: radius._12,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  chartTitle: {
    color: colors.white,
    fontSize: verticalScale(16),
    fontWeight: 'bold',
    marginBottom: spacingY._10,
    alignSelf: 'flex-start',
  },
  header: {},
  noChart: {
    backgroundColor: colors.neutral800,
    height: verticalScale(210),
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius._12,
  },
  noDataText: {
    color: colors.neutral350,
    fontSize: verticalScale(14),
  },
  searchIcon: {
    backgroundColor: colors.neutral700,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 100,
    height: verticalScale(35),
    width: verticalScale(35),
    borderCurve: "continuous",
  },
  segmentStyle: {
    height: scale(37),
    borderRadius: radius._8,
  },
  segmentFontStyle: {
    fontSize: verticalScale(13),
    fontWeight: "bold",
  },
  container: {
    paddingHorizontal: spacingX._20,
    paddingVertical: spacingY._5,
    gap: spacingY._10,
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacingX._10,
  },
  summaryCard: {
    flex: 1,
    padding: spacingY._12,
    borderRadius: radius._12,
    alignItems: 'center',
  },
  summaryLabel: {
    color: colors.neutral350,
    fontSize: verticalScale(12),
    marginBottom: spacingY._5,
  },
  summaryValue: {
    fontSize: verticalScale(14),
    fontWeight: 'bold',
  },
})