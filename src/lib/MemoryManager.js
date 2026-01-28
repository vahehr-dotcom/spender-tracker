import { supabase } from '../supabaseClient'

/**
 * MemoryManager - Unified memory system for Nova
 * Handles short-term (session), long-term (database), and learning
 */
export class MemoryManager {
  constructor(userId) {
    this.userId = userId
    this.sessionMessages = [] // Short-term: current conversation
    this.userProfile = null // Long-term: loaded from DB
    this.insights = [] // Learned patterns
    this.preferences = {} // User preferences
  }

  /**
   * Load user's complete profile from database
   */
  async loadProfile() {
    if (!this.userId) {
      console.warn('⚠️ No userId - skipping memory load')
      return null
    }

    try {
      console.log('🔍 Loading memory for user:', this.userId)

      // Load last 50 conversations for context
      const { data: conversations, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', this.userId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (convError) {
        console.error('❌ Conversations load error:', convError)
      }

      // Load insights (learned patterns)
      const { data: insights, error: insightsError } = await supabase
        .from('user_insights')
        .select('*')
        .eq('user_id', this.userId)
        .eq('is_active', true)

      if (insightsError) {
        console.error('❌ Insights load error:', insightsError)
      }

      // Load preferences
      const { data: prefs, error: prefsError } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', this.userId)

      if (prefsError) {
        console.error('❌ Preferences load error:', prefsError)
      }

      console.log('📦 Raw preferences from DB:', prefs)

      this.userProfile = {
        conversations: conversations || [],
        insights: insights || [],
        preferences: this.parsePreferences(prefs || [])
      }

      this.insights = insights || []
      this.preferences = this.parsePreferences(prefs || [])

      console.log('🧠 Memory loaded:', {
        conversations: conversations?.length || 0,
        insights: insights?.length || 0,
        preferences: Object.keys(this.preferences).length,
        preferenceDetails: this.preferences
      })

      return this.userProfile
    } catch (err) {
      console.error('💥 Memory load error:', err)
      return null
    }
  }

  /**
   * Parse preferences array into object
   */
  parsePreferences(prefs) {
    const obj = {}
    prefs.forEach(p => {
      obj[p.preference_type] = p.preference_value
    })
    return obj
  }

  /**
   * Add message to session memory
   */
  addMessage(role, content) {
    this.sessionMessages.push({ role, content, timestamp: new Date() })
    
    // Keep only last 20 messages to avoid token limits
    if (this.sessionMessages.length > 20) {
      this.sessionMessages = this.sessionMessages.slice(-20)
    }
  }

  /**
   * Get conversation history for AI prompt
   */
  getConversationHistory() {
    // Return last 10 session messages for context
    return this.sessionMessages.slice(-10)
  }

  /**
   * Save conversation to database (async, non-blocking)
   */
  async saveConversation(role, message) {
    if (!this.userId) return

    try {
      await supabase.from('conversations').insert({
        user_id: this.userId,
        role,
        message,
        created_at: new Date().toISOString()
      })
      console.log('💾 Conversation saved')
    } catch (err) {
      console.error('❌ Save conversation error:', err)
    }
  }

  /**
   * Extract and save insights from conversation
   */
  async learnFromConversation(userMessage, aiResponse) {
    if (!this.userId) return

    try {
      const insights = this.extractInsights(userMessage, aiResponse)

      for (const insight of insights) {
        if (insight.type === 'preference') {
          await this.savePreference(insight.key, insight.value)
        } else if (insight.type === 'insight') {
          await this.saveInsight(insight.category, insight.data)
        }
      }
    } catch (err) {
      console.error('❌ Learning error:', err)
    }
  }

  /**
   * Extract insights from messages (learning logic)
   */
  extractInsights(userMessage, aiResponse) {
    const insights = []
    const lower = userMessage.toLowerCase()

    // Learn name - FIXED: save as 'name' not 'nickname'
    if (lower.includes('my name is') || lower.includes("i'm ") || lower.includes("i am ")) {
      const nameMatch = userMessage.match(/(?:my name is|i'm|i am)\s+(\w+)/i)
      if (nameMatch) {
        const name = nameMatch[1]
        console.log('🎯 Extracted name:', name)
        insights.push({
          type: 'preference',
          key: 'name',
          value: name
        })
        // ALSO save as nickname for backwards compatibility
        insights.push({
          type: 'preference',
          key: 'nickname',
          value: name
        })
      }
    }

    // Learn communication style
    if (lower.includes('prefer short') || lower.includes('keep it brief') || lower.includes('be concise')) {
      insights.push({
        type: 'preference',
        key: 'response_style',
        value: 'concise'
      })
    }

    if (lower.includes('prefer detailed') || lower.includes('explain more') || lower.includes('tell me more')) {
      insights.push({
        type: 'preference',
        key: 'response_style',
        value: 'detailed'
      })
    }

    // Learn location
    if (lower.includes('i live in') || lower.includes("i'm from")) {
      const locationMatch = userMessage.match(/(?:i live in|i'm from)\s+([a-z\s]+?)(?:\.|,|$)/i)
      if (locationMatch) {
        insights.push({
          type: 'preference',
          key: 'location',
          value: locationMatch[1].trim()
        })
      }
    }

    // Learn spending patterns (from context)
    if (lower.includes('always') || lower.includes('usually') || lower.includes('typically')) {
      insights.push({
        type: 'insight',
        category: 'habit',
        data: { observation: userMessage }
      })
    }

    return insights
  }

  /**
   * Save preference to database
   */
  async savePreference(key, value) {
    if (!this.userId) return

    try {
      const { error } = await supabase.from('user_preferences').upsert({
        user_id: this.userId,
        preference_type: key,
        preference_value: value,
        set_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,preference_type'
      })

      if (error) {
        console.error('❌ Upsert error:', error)
        return
      }

      this.preferences[key] = value
      console.log('✅ Preference saved:', key, '=', value)
    } catch (err) {
      console.error('💥 Save preference error:', err)
    }
  }

  /**
   * Save insight to database
   */
  async saveInsight(category, data) {
    if (!this.userId) return

    try {
      await supabase.from('user_insights').insert({
        user_id: this.userId,
        insight_category: category,
        insight_text: JSON.stringify(data),
        learned_at: new Date().toISOString(),
        is_active: true
      })

      this.insights.push({ insight_category: category, insight_text: JSON.stringify(data) })
      console.log('💡 Insight saved:', category)
    } catch (err) {
      console.error('❌ Save insight error:', err)
    }
  }

  /**
   * Build memory context for AI prompt
   */
  buildMemoryContext() {
    const parts = []

    // Add name if known (check both 'name' and 'nickname')
    const userName = this.preferences.name || this.preferences.nickname
    if (userName) {
      parts.push(`User's name: ${userName}`)
    }

    // Add location if known
    if (this.preferences.location) {
      parts.push(`Lives in: ${this.preferences.location}`)
    }

    // Add response style preference
    if (this.preferences.response_style) {
      parts.push(`Prefers ${this.preferences.response_style} responses`)
    }

    // Add recent insights
    if (this.insights.length > 0) {
      const recentInsights = this.insights.slice(-5).map(i => i.insight_text || i.insight_data)
      parts.push(`Recent insights: ${recentInsights.join('; ')}`)
    }

    return parts.length > 0 ? `\n\n**What you know about this user:**\n${parts.join('\n')}` : ''
  }

  /**
   * Get user's preferred name
   */
  getNickname() {
    return this.preferences.name || this.preferences.nickname || 'friend'
  }

  /**
   * Get response style
   */
  getResponseStyle() {
    return this.preferences.response_style || 'friendly'
  }

  /**
   * Clear session (conversation reset)
   */
  clearSession() {
    this.sessionMessages = []
  }

  /**
   * Clear all memory (hard reset)
   */
  async clearAll() {
    if (!this.userId) return

    this.sessionMessages = []
    this.insights = []
    this.preferences = {}

    await supabase.from('conversations').delete().eq('user_id', this.userId)
    await supabase.from('user_insights').delete().eq('user_id', this.userId)
    await supabase.from('user_preferences').delete().eq('user_id', this.userId)
  }
}

export default MemoryManager
