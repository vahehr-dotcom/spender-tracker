import { supabase } from '../supabaseClient'

/**
 * PredictiveEngine - Predicts future spending and detects subscriptions
 */
class PredictiveEngine {
  constructor(userId, expenses, categories) {
    this.userId = userId
    this.expenses = expenses
    this.categories = categories
  }

  /**
   * Analyze all predictions and return notifications
   */
  async analyzePredictions() {
    const predictions = []

    // 1. Detect subscriptions
    const subscriptions = await this.detectSubscriptions()
    predictions.push(...subscriptions)

    // 2. Upcoming subscription renewals
    const renewals = await this.checkUpcomingRenewals()
    predictions.push(...renewals)

    // 3. Budget forecast
    const forecast = this.forecastMonthlySpending()
    if (forecast) predictions.push(forecast)

    // 4. Unused subscriptions
    const unused = await this.detectUnusedSubscriptions()
    predictions.push(...unused)

    return predictions
  }

  /**
   * Detect recurring subscriptions from expense patterns
   */
  async detectSubscriptions() {
    const subscriptions = []
    const merchantCharges = {}

    // Group charges by merchant
    for (const exp of this.expenses) {
      const merchant = exp.merchant.toLowerCase()
      if (!merchantCharges[merchant]) {
        merchantCharges[merchant] = []
      }
      merchantCharges[merchant].push({
        amount: parseFloat(exp.amount),
        date: new Date(exp.spent_at)
      })
    }

    // Detect recurring patterns
    for (const [merchant, charges] of Object.entries(merchantCharges)) {
      if (charges.length < 3) continue // Need at least 3 charges

      // Sort by date
      charges.sort((a, b) => a.date - b.date)

      // Check for consistent amounts
      const amounts = charges.map(c => c.amount)
      const avgAmount = amounts.reduce((sum, a) => sum + a, 0) / amounts.length
      const variance = amounts.every(a => Math.abs(a - avgAmount) < 1.0) // Within $1

      if (!variance) continue

      // Check for consistent intervals (monthly)
      const intervals = []
      for (let i = 1; i < charges.length; i++) {
        const daysDiff = (charges[i].date - charges[i - 1].date) / (1000 * 60 * 60 * 24)
        intervals.push(daysDiff)
      }

      const avgInterval = intervals.reduce((sum, d) => sum + d, 0) / intervals.length
      const isMonthly = avgInterval >= 25 && avgInterval <= 35 // ~30 days
      const isWeekly = avgInterval >= 5 && avgInterval <= 9 // ~7 days
      const isYearly = avgInterval >= 350 && avgInterval <= 380 // ~365 days

      if (isMonthly || isWeekly || isYearly) {
        const frequency = isMonthly ? 'monthly' : isWeekly ? 'weekly' : 'yearly'
        const lastCharge = charges[charges.length - 1].date
        const nextCharge = new Date(lastCharge)

        if (frequency === 'monthly') {
          nextCharge.setDate(nextCharge.getDate() + 30)
        } else if (frequency === 'weekly') {
          nextCharge.setDate(nextCharge.getDate() + 7)
        } else {
          nextCharge.setDate(nextCharge.getDate() + 365)
        }

        const displayMerchant = this.expenses.find(e => e.merchant.toLowerCase() === merchant)?.merchant || merchant

        // Save to database
        await this.saveSubscription({
          merchant: displayMerchant,
          amount: avgAmount,
          frequency,
          nextChargeDate: nextCharge,
          lastChargeDate: lastCharge,
          confidence: 0.9
        })

        subscriptions.push({
          type: 'subscription_detected',
          merchant: displayMerchant,
          amount: avgAmount.toFixed(2),
          frequency,
          nextCharge: nextCharge.toISOString().split('T')[0],
          message: `💳 Subscription detected: ${displayMerchant} charges $${avgAmount.toFixed(2)} ${frequency}`
        })
      }
    }

    return subscriptions
  }

  /**
   * Check for subscriptions renewing in next 7 days
   */
  async checkUpcomingRenewals() {
    const renewals = []

    try {
      const sevenDaysFromNow = new Date()
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)

      const { data: subs } = await supabase
        .from('subscriptions_detected')
        .select('*')
        .eq('user_id', this.userId)
        .eq('is_active', true)
        .lte('next_charge_date', sevenDaysFromNow.toISOString().split('T')[0])
        .gte('next_charge_date', new Date().toISOString().split('T')[0])

      for (const sub of subs || []) {
        const nextDate = new Date(sub.next_charge_date)
        const daysUntil = Math.ceil((nextDate - new Date()) / (1000 * 60 * 60 * 24))

        let timeText = daysUntil === 0 ? 'today' : daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`

        renewals.push({
          type: 'subscription_renewal',
          merchant: sub.merchant,
          amount: sub.amount,
          daysUntil,
          message: `⏰ ${sub.merchant} renews ${timeText} ($${parseFloat(sub.amount).toFixed(2)})`
        })
      }
    } catch (err) {
      console.error('Error checking renewals:', err)
    }

    return renewals
  }

  /**
   * Forecast monthly spending based on current pace
   */
  forecastMonthlySpending() {
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()
    const dayOfMonth = now.getDate()
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()

    // Calculate this month's spending
    const thisMonthExpenses = this.expenses.filter((e) => {
      const d = new Date(e.spent_at)
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear
    })

    if (thisMonthExpenses.length === 0) return null

    const totalSpent = thisMonthExpenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0)
    const avgPerDay = totalSpent / dayOfMonth
    const remainingDays = daysInMonth - dayOfMonth
    const forecastTotal = totalSpent + avgPerDay * remainingDays

    // Hardcoded budget for now (make dynamic later)
    const budget = 2000
    const percentOfBudget = (forecastTotal / budget) * 100

    if (percentOfBudget > 90) {
      return {
        type: 'budget_forecast_alert',
        forecastTotal: forecastTotal.toFixed(2),
        budget,
        percentOfBudget: percentOfBudget.toFixed(0),
        message: `⚠️ Budget Alert: At this rate, you'll spend $${forecastTotal.toFixed(2)} this month (${percentOfBudget.toFixed(0)}% of budget)`
      }
    } else if (dayOfMonth >= 15) {
      // Mid-month forecast (neutral)
      return {
        type: 'budget_forecast',
        forecastTotal: forecastTotal.toFixed(2),
        budget,
        percentOfBudget: percentOfBudget.toFixed(0),
        message: `📊 Forecast: On track to spend $${forecastTotal.toFixed(2)} this month (${percentOfBudget.toFixed(0)}% of budget)`
      }
    }

    return null
  }

  /**
   * Detect unused subscriptions (no related expenses in 60 days)
   */
  async detectUnusedSubscriptions() {
    const unused = []

    try {
      const sixtyDaysAgo = new Date()
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)

      const { data: subs } = await supabase
        .from('subscriptions_detected')
        .select('*')
        .eq('user_id', this.userId)
        .eq('is_active', true)

      for (const sub of subs || []) {
        // Check if merchant has any recent activity
        const recentActivity = this.expenses.find(exp => {
          const expDate = new Date(exp.spent_at)
          return exp.merchant.toLowerCase() === sub.merchant.toLowerCase() && 
                 expDate >= sixtyDaysAgo &&
                 Math.abs(parseFloat(exp.amount) - parseFloat(sub.amount)) > 1.0 // Not the subscription charge itself
        })

        if (!recentActivity) {
          const daysSinceCharge = Math.floor((new Date() - new Date(sub.last_charge_date)) / (1000 * 60 * 60 * 24))

          unused.push({
            type: 'unused_subscription',
            merchant: sub.merchant,
            amount: sub.amount,
            daysSinceUse: daysSinceCharge,
            message: `💡 You haven't used ${sub.merchant} in ${daysSinceCharge} days, but you're still paying $${parseFloat(sub.amount).toFixed(2)}/${sub.frequency}`
          })
        }
      }
    } catch (err) {
      console.error('Error detecting unused subscriptions:', err)
    }

    return unused
  }

  /**
   * Save subscription to database
   */
  async saveSubscription(subscription) {
    try {
      // Check if subscription already exists
      const { data: existing } = await supabase
        .from('subscriptions_detected')
        .select('id')
        .eq('user_id', this.userId)
        .eq('merchant', subscription.merchant)
        .single()

      if (existing) {
        // Update existing
        await supabase
          .from('subscriptions_detected')
          .update({
            amount: subscription.amount,
            frequency: subscription.frequency,
            next_charge_date: subscription.nextChargeDate.toISOString().split('T')[0],
            last_charge_date: subscription.lastChargeDate.toISOString().split('T')[0],
            confidence_score: subscription.confidence,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
      } else {
        // Insert new
        await supabase.from('subscriptions_detected').insert({
          user_id: this.userId,
          merchant: subscription.merchant,
          amount: subscription.amount,
          frequency: subscription.frequency,
          next_charge_date: subscription.nextChargeDate.toISOString().split('T')[0],
          last_charge_date: subscription.lastChargeDate.toISOString().split('T')[0],
          confidence_score: subscription.confidence,
          is_active: true
        })
      }
    } catch (err) {
      console.error('Error saving subscription:', err)
    }
  }
}

export default PredictiveEngine
