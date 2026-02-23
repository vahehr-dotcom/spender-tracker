import { supabase } from '../supabaseClient'

class SpendingInsights {

  // Get all insights for Nova's system prompt
  static async buildInsightsForNova(userId, isProMode = true) {
    if (!userId) return ''

    try {
      const promises = [
        SpendingInsights.getWeeklyAlerts(userId),
        SpendingInsights.getTopMerchants(userId),
        SpendingInsights.getMonthlyTrends(userId)
      ]

      if (isProMode) {
        promises.push(SpendingInsights.getBudgetStatus(userId))
      }

      const [weeklyAlerts, topMerchants, monthlyTrends, budgetStatus] = await Promise.all(promises)

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

      if (budgetStatus && budgetStatus.length > 0) {
        insights += '\n\n**🎯 Budget Goals (only share when user asks about budgets):**\n'
        insights += budgetStatus.map(b => `- ${b}`).join('\n')
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
      const { data: thisWeek } = await supabase
        .from('spending_patterns')
        .select('category_name, total_amount, transaction_count')
        .eq('user_id', userId)
        .eq('period_type', 'weekly')
        .eq('period_start', thisWeekStr)
        .eq('merchant_name', '__category__')

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

  // Budget goals — compare spending vs user-set limits
  static async getBudgetStatus(userId) {
    const status = []
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)

    try {
      const { data: goals } = await supabase
        .from('budget_goals')
        .select('category_name, monthly_limit')
        .eq('user_id', userId)

      if (!goals || goals.length === 0) return status

      const { data: spending } = await supabase
        .from('spending_patterns')
        .select('category_name, total_amount')
        .eq('user_id', userId)
        .eq('period_type', 'monthly')
        .eq('period_start', monthStart)
        .eq('merchant_name', '__category__')

      const spendingMap = {}
      if (spending) {
        for (const row of spending) {
          spendingMap[row.category_name] = Number(row.total_amount)
        }
      }

      for (const goal of goals) {
        const spent = spendingMap[goal.category_name] || 0
        const limit = Number(goal.monthly_limit)
        const pct = Math.round((spent / limit) * 100)

        if (pct >= 100) {
          status.push(`${goal.category_name}: $${spent.toFixed(0)}/$${limit.toFixed(0)} — OVER BUDGET by $${(spent - limit).toFixed(0)}`)
        } else if (pct >= 75) {
          status.push(`${goal.category_name}: $${spent.toFixed(0)}/$${limit.toFixed(0)} — ${pct}% used, getting close`)
        } else {
          status.push(`${goal.category_name}: $${spent.toFixed(0)}/$${limit.toFixed(0)} — ${pct}% used`)
        }
      }
    } catch (err) {
      console.error('❌ Budget status error:', err)
    }

    return status
  }

  // Set or update a budget goal
  static async setBudgetGoal(userId, categoryName, monthlyLimit) {
    try {
      const { data, error } = await supabase
        .from('budget_goals')
        .upsert({
          user_id: userId,
          category_name: categoryName,
          monthly_limit: monthlyLimit,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,category_name' })

      if (error) {
        console.error('❌ Set budget goal error:', error)
        return { success: false, error: error.message }
      }
      return { success: true }
    } catch (err) {
      console.error('❌ Set budget goal error:', err)
      return { success: false, error: err.message }
    }
  }

  // Remove a budget goal
  static async removeBudgetGoal(userId, categoryName) {
    try {
      const { error } = await supabase
        .from('budget_goals')
        .delete()
        .eq('user_id', userId)
        .eq('category_name', categoryName)

      if (error) {
        console.error('❌ Remove budget goal error:', error)
        return { success: false, error: error.message }
      }
      return { success: true }
    } catch (err) {
      console.error('❌ Remove budget goal error:', err)
      return { success: false, error: err.message }
    }
  }

  // Get all budget goals for a user
  static async getBudgetGoals(userId) {
    try {
      const { data, error } = await supabase
        .from('budget_goals')
        .select('category_name, monthly_limit')
        .eq('user_id', userId)
        .order('category_name')

      if (error) return []
      return data || []
    } catch (err) {
      return []
    }
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