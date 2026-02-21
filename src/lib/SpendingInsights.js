import { supabase } from '../supabaseClient'

class SpendingInsights {

  // Get all insights for Nova's system prompt
  static async buildInsightsForNova(userId) {
    if (!userId) return ''

    try {
      const [weeklyAlerts, topMerchants, monthlyTrends] = await Promise.all([
        SpendingInsights.getWeeklyAlerts(userId),
        SpendingInsights.getTopMerchants(userId),
        SpendingInsights.getMonthlyTrends(userId)
      ])

      let insights = ''

      if (weeklyAlerts.length > 0) {
        insights += '\n\n**⚠️ Spending Alerts This Week:**\n'
        insights += weeklyAlerts.map(a => `- ${a}`).join('\n')
      }

      if (topMerchants.length > 0) {
        insights += '\n\n**🏪 Merchant Patterns:**\n'
        insights += topMerchants.map(m => `- ${m}`).join('\n')
      }

      if (monthlyTrends.length > 0) {
        insights += '\n\n**📊 Monthly Trends:**\n'
        insights += monthlyTrends.map(t => `- ${t}`).join('\n')
      }

      if (insights) {
        insights = '\n\n**Nova\'s Financial Intelligence (use naturally in conversation, don\'t dump all at once):**' + insights
      }

      return insights
    } catch (err) {
      console.error('❌ SpendingInsights error:', err)
      return ''
    }
  }

  // Compare this week's spending vs last week per category
  static async getWeeklyAlerts(userId) {
    const alerts = []
    const now = new Date()
    const thisWeekStart = new Date(now)
    thisWeekStart.setDate(now.getDate() - now.getDay())
    const lastWeekStart = new Date(thisWeekStart)
    lastWeekStart.setDate(lastWeekStart.getDate() - 7)

    const thisWeekStr = thisWeekStart.toISOString().slice(0, 10)
    const lastWeekStr = lastWeekStart.toISOString().slice(0, 10)

    try {
      // Get this week's category totals
      const { data: thisWeek } = await supabase
        .from('spending_patterns')
        .select('category_name, total_amount, transaction_count')
        .eq('user_id', userId)
        .eq('period_type', 'weekly')
        .eq('period_start', thisWeekStr)
        .eq('merchant_name', '__category__')

      // Get last week's category totals
      const { data: lastWeek } = await supabase
        .from('spending_patterns')
        .select('category_name, total_amount, transaction_count')
        .eq('user_id', userId)
        .eq('period_type', 'weekly')
        .eq('period_start', lastWeekStr)
        .eq('merchant_name', '__category__')

      if (!thisWeek || !lastWeek) return alerts

      const lastWeekMap = {}
      for (const row of lastWeek) {
        lastWeekMap[row.category_name] = row
      }

      for (const row of thisWeek) {
        const prev = lastWeekMap[row.category_name]
        if (prev && prev.total_amount > 0) {
          const ratio = row.total_amount / prev.total_amount
          if (ratio >= 2.0) {
            alerts.push(
              `${row.category_name}: $${Number(row.total_amount).toFixed(0)} this week vs $${Number(prev.total_amount).toFixed(0)} last week (${ratio.toFixed(1)}x increase)`
            )
          } else if (ratio >= 1.5) {
            alerts.push(
              `${row.category_name}: spending up 50%+ this week ($${Number(row.total_amount).toFixed(0)} vs $${Number(prev.total_amount).toFixed(0)} last week)`
            )
          }
        }
      }
    } catch (err) {
      console.error('❌ Weekly alerts error:', err)
    }

    return alerts
  }

  // Get top merchants by frequency and amount (current month)
  static async getTopMerchants(userId) {
    const patterns = []
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)

    try {
      const { data } = await supabase
        .from('spending_patterns')
        .select('merchant_name, category_name, total_amount, transaction_count, avg_amount')
        .eq('user_id', userId)
        .eq('period_type', 'monthly')
        .eq('period_start', monthStart)
        .neq('merchant_name', '__category__')
        .order('transaction_count', { ascending: false })
        .limit(10)

      if (!data) return patterns

      for (const row of data) {
        if (row.transaction_count >= 3) {
          patterns.push(
            `${row.merchant_name}: ${row.transaction_count} visits this month, $${Number(row.total_amount).toFixed(0)} total, ~$${Number(row.avg_amount).toFixed(0)} avg`
          )
        } else if (row.transaction_count >= 2) {
          patterns.push(
            `${row.merchant_name}: ${row.transaction_count}x this month, $${Number(row.total_amount).toFixed(0)} total`
          )
        }
      }
    } catch (err) {
      console.error('❌ Top merchants error:', err)
    }

    return patterns
  }

  // Compare this month vs last month per category
  static async getMonthlyTrends(userId) {
    const trends = []
    const now = new Date()
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10)

    // How far through the month are we (for projection)
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const dayOfMonth = now.getDate()
    const monthProgress = dayOfMonth / daysInMonth

    try {
      const { data: thisMonth } = await supabase
        .from('spending_patterns')
        .select('category_name, total_amount, transaction_count')
        .eq('user_id', userId)
        .eq('period_type', 'monthly')
        .eq('period_start', thisMonthStart)
        .eq('merchant_name', '__category__')

      const { data: lastMonth } = await supabase
        .from('spending_patterns')
        .select('category_name, total_amount, transaction_count')
        .eq('user_id', userId)
        .eq('period_type', 'monthly')
        .eq('period_start', lastMonthStart)
        .eq('merchant_name', '__category__')

      if (!thisMonth || !lastMonth) return trends

      const lastMonthMap = {}
      for (const row of lastMonth) {
        lastMonthMap[row.category_name] = row
      }

      for (const row of thisMonth) {
        const prev = lastMonthMap[row.category_name]
        if (prev && prev.total_amount > 20 && monthProgress > 0.25) {
          const projected = row.total_amount / monthProgress
          const ratio = projected / prev.total_amount

          if (ratio >= 1.5) {
            trends.push(
              `${row.category_name}: on pace for ~$${projected.toFixed(0)} this month vs $${Number(prev.total_amount).toFixed(0)} last month`
            )
          } else if (ratio <= 0.5) {
            trends.push(
              `${row.category_name}: trending down — ~$${projected.toFixed(0)} projected vs $${Number(prev.total_amount).toFixed(0)} last month 👍`
            )
          }
        }
      }
    } catch (err) {
      console.error('❌ Monthly trends error:', err)
    }

    return trends
  }

  // Quick summary for Nova to reference
  static async getQuickSummary(userId) {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)

    try {
      const { data } = await supabase
        .from('spending_patterns')
        .select('category_name, total_amount')
        .eq('user_id', userId)
        .eq('period_type', 'monthly')
        .eq('period_start', monthStart)
        .eq('merchant_name', '__category__')
        .order('total_amount', { ascending: false })

      if (!data || data.length === 0) return null

      const total = data.reduce((sum, r) => sum + Number(r.total_amount), 0)
      const topCategory = data[0]

      return {
        monthlyTotal: total,
        topCategory: topCategory.category_name,
        topCategoryAmount: Number(topCategory.total_amount),
        categoryCount: data.length
      }
    } catch (err) {
      console.error('❌ Quick summary error:', err)
      return null
    }
  }
}

export default SpendingInsights