import { supabase } from '../supabaseClient'

/**
 * PatternAnalyzer - Detects spending patterns and anomalies
 */
class PatternAnalyzer {
  constructor(userId, expenses, categories) {
    this.userId = userId
    this.expenses = expenses
    this.categories = categories
  }

  /**
   * Analyze all patterns and return notifications
   */
  async analyzePatterns() {
    const patterns = []

    // 1. Day-of-week patterns
    const dayPatterns = this.analyzeDayOfWeekPatterns()
    patterns.push(...dayPatterns)

    // 2. Price anomalies
    const anomalies = this.detectPriceAnomalies()
    patterns.push(...anomalies)

    // 3. Merchant frequency patterns
    const frequencyPatterns = this.analyzeMerchantFrequency()
    patterns.push(...frequencyPatterns)

    // Save patterns to database
    for (const pattern of patterns) {
      await this.savePattern(pattern)
    }

    return patterns
  }

  /**
   * Detect day-of-week spending patterns
   * Example: "You always buy gas on Thursdays"
   */
  analyzeDayOfWeekPatterns() {
    const patterns = []
    const merchantDays = {}

    // Group expenses by merchant and day of week
    for (const exp of this.expenses) {
      const date = new Date(exp.spent_at)
      const dayOfWeek = date.getDay() // 0=Sunday, 6=Saturday
      const merchant = exp.merchant.toLowerCase()

      if (!merchantDays[merchant]) {
        merchantDays[merchant] = {}
      }
      merchantDays[merchant][dayOfWeek] = (merchantDays[merchant][dayOfWeek] || 0) + 1
    }

    // Find strong day-of-week patterns (70%+ of visits on same day)
    for (const [merchant, days] of Object.entries(merchantDays)) {
      const totalVisits = Object.values(days).reduce((sum, count) => sum + count, 0)
      
      if (totalVisits >= 3) { // Need at least 3 visits
        for (const [day, count] of Object.entries(days)) {
          const percentage = count / totalVisits
          
          if (percentage >= 0.7) { // 70%+ pattern
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
            patterns.push({
              type: 'day_of_week',
              merchant: this.expenses.find(e => e.merchant.toLowerCase() === merchant)?.merchant || merchant,
              day: dayNames[parseInt(day)],
              confidence: percentage,
              count: totalVisits,
              message: `🔍 Pattern detected: You usually visit ${merchant} on ${dayNames[parseInt(day)]}s (${count}/${totalVisits} times)`
            })
          }
        }
      }
    }

    return patterns
  }

  /**
   * Detect price anomalies
   * Example: "Shell usually costs $45, but this time $65 (+44%)"
   */
  detectPriceAnomalies() {
    const anomalies = []
    const merchantPrices = {}

    // Calculate average price per merchant
    for (const exp of this.expenses) {
      const merchant = exp.merchant.toLowerCase()
      if (!merchantPrices[merchant]) {
        merchantPrices[merchant] = []
      }
      merchantPrices[merchant].push(parseFloat(exp.amount))
    }

    // Check recent expenses for anomalies
    const recentExpenses = this.expenses.slice(0, 10) // Last 10 expenses

    for (const exp of recentExpenses) {
      const merchant = exp.merchant.toLowerCase()
      const prices = merchantPrices[merchant]

      if (prices && prices.length >= 3) { // Need at least 3 data points
        const currentPrice = parseFloat(exp.amount)
        const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length
        const difference = currentPrice - avgPrice
        const percentChange = (difference / avgPrice) * 100

        // Flag if 25%+ deviation
        if (Math.abs(percentChange) >= 25) {
          const direction = percentChange > 0 ? 'higher' : 'lower'
          anomalies.push({
            type: 'price_anomaly',
            merchant: exp.merchant,
            currentPrice,
            avgPrice: avgPrice.toFixed(2),
            difference: Math.abs(difference).toFixed(2),
            percentChange: Math.abs(percentChange).toFixed(0),
            direction,
            message: `⚠️ ${exp.merchant} was $${currentPrice.toFixed(2)} (usually ~$${avgPrice.toFixed(2)}) - ${Math.abs(percentChange).toFixed(0)}% ${direction} than usual`
          })
        }
      }
    }

    return anomalies
  }

  /**
   * Analyze merchant visit frequency
   * Example: "You visit Starbucks 3x per week on average"
   */
  analyzeMerchantFrequency() {
    const patterns = []
    const merchantVisits = {}

    // Count visits per merchant in last 30 days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    for (const exp of this.expenses) {
      const expDate = new Date(exp.spent_at)
      if (expDate >= thirtyDaysAgo) {
        const merchant = exp.merchant.toLowerCase()
        merchantVisits[merchant] = (merchantVisits[merchant] || 0) + 1
      }
    }

    // Find frequent merchants (5+ visits in 30 days)
    for (const [merchant, count] of Object.entries(merchantVisits)) {
      if (count >= 5) {
        const perWeek = (count / 30 * 7).toFixed(1)
        const displayMerchant = this.expenses.find(e => e.merchant.toLowerCase() === merchant)?.merchant || merchant
        
        patterns.push({
          type: 'frequency',
          merchant: displayMerchant,
          count,
          perWeek,
          message: `📊 You visit ${displayMerchant} frequently: ${count} times in the last 30 days (~${perWeek}x per week)`
        })
      }
    }

    return patterns
  }

  /**
   * Save pattern to database
   */
  async savePattern(pattern) {
    try {
      // Check if pattern already exists (avoid duplicates)
      const { data: existing } = await supabase
        .from('spending_patterns')
        .select('id')
        .eq('user_id', this.userId)
        .eq('pattern_type', pattern.type)
        .eq('pattern_data->merchant', pattern.merchant)
        .single()

      if (existing) {
        // Update last_detected timestamp
        await supabase
          .from('spending_patterns')
          .update({ last_detected: new Date().toISOString() })
          .eq('id', existing.id)
      } else {
        // Insert new pattern
        await supabase.from('spending_patterns').insert({
          user_id: this.userId,
          pattern_type: pattern.type,
          pattern_data: pattern,
          confidence_score: pattern.confidence || 0.8,
          last_detected: new Date().toISOString()
        })
      }
    } catch (err) {
      console.error('Error saving pattern:', err)
    }
  }

  /**
   * Fetch saved patterns for user
   */
  static async fetchPatterns(userId, limit = 5) {
    try {
      const { data, error } = await supabase
        .from('spending_patterns')
        .select('*')
        .eq('user_id', userId)
        .order('last_detected', { ascending: false })
        .limit(limit)

      if (error) throw error
      return data || []
    } catch (err) {
      console.error('Error fetching patterns:', err)
      return []
    }
  }
}

export default PatternAnalyzer
