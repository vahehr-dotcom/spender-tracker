import { supabase } from '../supabaseClient'
import PatternAnalyzer from './PatternAnalyzer'
import PredictiveEngine from './PredictiveEngine'

/**
 * ProactiveEngine - Generates proactive notifications
 */
class ProactiveEngine {
  constructor(userId, expenses, categories) {
    this.userId = userId
    this.expenses = expenses
    this.categories = categories
  }

  /**
   * Generate all types of notifications
   */
  async generateNotifications() {
    const notifications = []

    // 1. Greeting
    const greeting = await this.generateGreeting()
    if (greeting) notifications.push(greeting)

    // 2. Inactivity check
    const inactivity = this.checkInactivity()
    if (inactivity) notifications.push(inactivity)

    // 3. Budget win
    const budgetWin = this.checkBudgetWin()
    if (budgetWin) notifications.push(budgetWin)

    // 4. Pattern notifications
    const patterns = await this.generatePatternNotifications()
    notifications.push(...patterns)

    // 🔥 NEW: 5. Predictive notifications
    const predictions = await this.generatePredictiveNotifications()
    notifications.push(...predictions)

    // Save all notifications
    for (const notif of notifications) {
      await this.saveNotification(notif)
    }

    return notifications
  }

  /**
   * Generate time-based greeting
   */
  async generateGreeting() {
    const hour = new Date().getHours()
    let greeting = 'Good evening'
    if (hour < 12) greeting = 'Good morning'
    else if (hour < 18) greeting = 'Good afternoon'

    // Get user's name
    const { data: prefs } = await supabase
      .from('user_preferences')
      .select('preference_value')
      .eq('user_id', this.userId)
      .eq('preference_type', 'name')
      .single()

    const name = prefs?.preference_value || 'there'

    return {
      type: 'greeting',
      message: `${greeting} ${name}! Ready to track today's spending?`
    }
  }

  /**
   * Check for spending inactivity
   */
  checkInactivity() {
    if (this.expenses.length === 0) return null

    const lastExpense = new Date(this.expenses[0].spent_at)
    const now = new Date()
    const daysSince = Math.floor((now - lastExpense) / (1000 * 60 * 60 * 24))

    if (daysSince >= 3) {
      return {
        type: 'inactivity',
        message: `⏰ You haven't logged any expenses in ${daysSince} days. Everything okay?`
      }
    }

    return null
  }

  /**
   * Celebrate budget wins
   */
  checkBudgetWin() {
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()
    const dayOfMonth = now.getDate()
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()

    // Only check near end of month (after day 25)
    if (dayOfMonth < 25) return null

    // Calculate this month's spending
    const thisMonthExpenses = this.expenses.filter((e) => {
      const d = new Date(e.spent_at)
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear
    })

    const totalSpent = thisMonthExpenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0)

    // Hardcoded budget for now (make dynamic later)
    const budget = 2000
    const percentUsed = (totalSpent / budget) * 100

    if (percentUsed < 90) {
      const remaining = budget - totalSpent
      return {
        type: 'budget_win',
        message: `🎉 Great job! You're under budget this month with $${remaining.toFixed(2)} left to spend!`
      }
    }

    return null
  }

  /**
   * Generate pattern-based notifications
   */
  async generatePatternNotifications() {
    const notifications = []

    try {
      // Run pattern analysis
      const analyzer = new PatternAnalyzer(this.userId, this.expenses, this.categories)
      const patterns = await analyzer.analyzePatterns()

      // Convert patterns to notifications (limit to 3 most interesting)
      const topPatterns = patterns.slice(0, 3)

      for (const pattern of topPatterns) {
        notifications.push({
          type: 'pattern_detected',
          message: pattern.message,
          data: pattern
        })
      }
    } catch (err) {
      console.error('Error generating pattern notifications:', err)
    }

    return notifications
  }

  /**
   * 🔥 NEW: Generate predictive notifications
   */
  async generatePredictiveNotifications() {
    const notifications = []

    try {
      // Run predictive analysis
      const predictor = new PredictiveEngine(this.userId, this.expenses, this.categories)
      const predictions = await predictor.analyzePredictions()

      // Convert predictions to notifications
      for (const prediction of predictions) {
        notifications.push({
          type: prediction.type,
          message: prediction.message,
          data: prediction
        })
      }
    } catch (err) {
      console.error('Error generating predictive notifications:', err)
    }

    return notifications
  }

  /**
   * Save notification to database
   */
  async saveNotification(notification) {
    try {
      // Check if similar notification exists in last 24 hours (avoid spam)
      const oneDayAgo = new Date()
      oneDayAgo.setDate(oneDayAgo.getDate() - 1)

      const { data: existing } = await supabase
        .from('proactive_notifications')
        .select('id')
        .eq('user_id', this.userId)
        .eq('notification_type', notification.type)
        .gte('created_at', oneDayAgo.toISOString())
        .single()

      if (existing) {
        console.log('⏭️ Skipping duplicate notification:', notification.type)
        return
      }

      // Insert new notification
      await supabase.from('proactive_notifications').insert({
        user_id: this.userId,
        notification_type: notification.type,
        message: notification.message,
        action_data: notification.data || null
      })

      console.log('✅ Notification saved:', notification.type)
    } catch (err) {
      console.error('Error saving notification:', err)
    }
  }

  /**
   * Fetch active notifications
   */
  static async fetchNotifications(userId, limit = 5) {
    try {
      const { data, error } = await supabase
        .from('proactive_notifications')
        .select('*')
        .eq('user_id', userId)
        .eq('is_dismissed', false)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return data || []
    } catch (err) {
      console.error('Error fetching notifications:', err)
      return []
    }
  }

  /**
   * Dismiss notification
   */
  static async dismissNotification(notificationId) {
    try {
      await supabase
        .from('proactive_notifications')
        .update({ is_dismissed: true, dismissed_at: new Date().toISOString() })
        .eq('id', notificationId)
    } catch (err) {
      console.error('Error dismissing notification:', err)
    }
  }
}

export default ProactiveEngine
