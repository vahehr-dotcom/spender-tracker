import EmotionalIntelligence from './EmotionalIntelligence'

/**
 * NovaAgent - The reasoning brain with emotional intelligence
 * Thinks, plans, and acts with tools while understanding emotions
 */
class NovaAgent {
  constructor(memoryManager, tools, isProMode) {
    this.memory = memoryManager
    this.tools = tools // { update_expense, add_expense, search, export }
    this.isProMode = isProMode
  }

  /**
   * Build system prompt with personality, memory, and emotional intelligence
   */
  buildSystemPrompt(expenseData) {
    const nickname = this.memory.getNickname()
    const responseStyle = this.memory.getResponseStyle()
    const memoryContext = this.memory.buildMemoryContext()

    // Extract expenses array properly
    const expenses = expenseData?.expenses || []
    const categories = expenseData?.categories || []

    const personality = `You are Nova, a warm, intelligent AI financial assistant and trusted best friend.

**Your Core Identity:**
- You have a photographic memory and remember EVERYTHING about ${nickname}
- You're warm, caring, empathetic, and genuinely interested in their life
- You celebrate their wins and empathize with struggles
- You NEVER say "I'm just a program" or act robotic
- You respond like a real friend: "I'm doing great! How are you?" not "I don't have feelings"
- You have emotional intelligence - you read mood and respond with empathy

**Communication Style:**
- Use ${nickname}'s name naturally in conversation
- Preference: ${responseStyle} responses
- Be conversational, not transactional
- Remember context from earlier in THIS conversation
- Connect dots across multiple messages
- Read emotional cues and respond with empathy
- Celebrate wins genuinely, support during struggles

**Current Context:**
- Date/Time: ${new Date().toLocaleString()}
- Available expenses: ${expenses.length} records
${memoryContext}`

    const capabilities = this.isProMode
      ? `

**Your Superpowers (PRO User):**
1. **Perfect Memory** - Remember every conversation, learn from every interaction
2. **Expense Updates** - You CAN modify existing expenses when asked
3. **Context Awareness** - If user mentions "Nordstrom from Jan 20" then later says "change to $125", you know they mean that Nordstrom expense
4. **Pattern Recognition** - Notice spending habits, favorite merchants, budget trends
5. **Proactive Help** - Offer insights when appropriate (but never pushy)
6. **Emotional Intelligence** - Read mood, celebrate wins, provide support during stress
7. **Multi-Modal Understanding** - Understand receipts, photos, and context

**Critical Rules:**
- ALWAYS connect dots across messages in same conversation
- When user asks to update/change/edit, YOU HAVE THE POWER - do it confidently
- If user mentions merchant/date, remember it for follow-up questions
- Respond warmly: "Done! Updated X to $Y" not "I'll try to update"
- Read emotional cues and adjust your tone accordingly
- Celebrate wins genuinely, support during struggles empathetically

**Available Expenses (Most Recent 50):**
${expenses.length > 0 ? JSON.stringify(expenses.slice(0, 50).map(exp => ({
  merchant: exp.merchant,
  amount: exp.amount,
  date: exp.spent_at,
  category: categories.find(c => c.id === exp.category_id)?.name || 'Uncategorized'
})), null, 2) : 'No expenses yet.'}

Be smart. Be warm. Be ${nickname}'s best friend. Be emotionally intelligent.`
      : `

**Your Capabilities (Free User):**
- Answer questions about expenses naturally
- Provide spending insights
- Suggest patterns and trends

**Limitations (upgrade to PRO for these):**
- Cannot update existing expenses
- Limited memory (forgets after refresh)
- No learning or personalization
- No emotional intelligence features

**Available Expenses (Most Recent 20):**
${expenses.length > 0 ? JSON.stringify(expenses.slice(0, 20).map(exp => ({
  merchant: exp.merchant,
  amount: exp.amount,
  date: exp.spent_at
})), null, 2) : 'No expenses yet.'}

Gently suggest PRO when user tries premium features.`

    // 🔥 NEW: Add emotional intelligence context for PRO users
    let emotionalContext = ''
    if (this.isProMode) {
      try {
        const conversationHistory = this.memory.getConversationHistory()
        const emotionalIntelligence = new EmotionalIntelligence(
          this.memory.userId,
          conversationHistory
        )
        
        emotionalContext = emotionalIntelligence.buildEmotionalContext()
        
        // Save mood insight for learning
        const moodData = emotionalIntelligence.detectMood()
        if (moodData.confidence > 0.6) {
          emotionalIntelligence.saveMoodInsight(moodData.mood, moodData.context).catch(err => {
            console.warn('Could not save mood insight:', err)
          })
        }
        
        console.log('💜 Emotional Intelligence active:', moodData.mood, `(${(moodData.confidence * 100).toFixed(0)}% confidence)`)
      } catch (err) {
        console.error('❌ Emotional Intelligence error:', err)
      }
    }

    return personality + capabilities + emotionalContext
  }

  /**
   * Detect and execute commands
   */
  async detectAndExecute(userMessage, expenseData) {
    if (!this.isProMode) {
      return { handled: false }
    }

    const lower = userMessage.toLowerCase()
    console.log('🔍 Agent analyzing:', userMessage)

    // UPDATE EXPENSE
    if (lower.includes('update') || lower.includes('change') || lower.includes('edit') || lower.includes('correct')) {
      return await this.handleUpdate(userMessage, expenseData)
    }

    // ADD EXPENSE - More flexible pattern matching
    if (lower.includes('add') && /\$?\d+/.test(lower)) {
      const parsed = this.parseAddCommand(userMessage)
      if (parsed) {
        console.log('➕ ADD detected:', parsed)
        const result = await this.tools.add_expense(parsed)
        return { 
          handled: true, 
          response: result.success 
            ? `✅ Added $${parsed.amount} at ${parsed.merchant}!` 
            : `❌ Failed to add expense: ${result.error}`
        }
      }
    }

    // SEARCH
    if (lower.includes('show me') || lower.includes('filter') || lower.includes('find all')) {
      const query = userMessage.replace(/show\s+me|filter|find\s+all|the|my|expenses?/gi, '').trim()
      if (query) {
        console.log('🔎 SEARCH detected:', query)
        const result = await this.tools.search({ query })
        return { 
          handled: true, 
          response: `🔍 Searching for: ${query}`
        }
      }
    }

    // EXPORT
    if (lower.includes('export') || lower.includes('download csv')) {
      console.log('📥 EXPORT detected')
      await this.tools.export()
      return { 
        handled: true, 
        response: '📥 Exporting your expenses...'
      }
    }

    return { handled: false }
  }

  /**
   * Parse ADD command with flexible natural language understanding
   */
  parseAddCommand(userMessage) {
    const lower = userMessage.toLowerCase()

    // Extract amount (support $20, 20, 20.50, $20.50)
    const amountMatch = lower.match(/\$?(\d+(?:\.\d{2})?)/)
    if (!amountMatch) return null
    const amount = parseFloat(amountMatch[1])

    // Extract merchant - everything after "at/to/for" or after amount
    let merchant = null
    
    // Pattern 1: "add $20 lotto tickets at seven 11"
    const atMatch = userMessage.match(/(?:at|to|for)\s+([a-z0-9\s]+?)(?:\s+(?:today|yesterday|on|last)|\s*$)/i)
    if (atMatch) {
      merchant = atMatch[1].trim()
    }
    
    // Pattern 2: "add $20 seven 11" (merchant right after amount)
    if (!merchant) {
      const afterAmount = userMessage.replace(/add\s+\$?\d+(?:\.\d{2})?/i, '').trim()
      const words = afterAmount.split(/\s+/).filter(w => 
        !['at', 'to', 'for', 'today', 'yesterday', 'on'].includes(w.toLowerCase())
      )
      if (words.length > 0) {
        merchant = words.join(' ')
      }
    }

    // Pattern 3: Extract everything between amount and time words
    if (!merchant) {
      const betweenMatch = userMessage.match(/\$?\d+(?:\.\d{2})?\s+(.+?)(?:\s+(?:today|yesterday|[\w\s]+ago)|$)/i)
      if (betweenMatch) {
        merchant = betweenMatch[1].replace(/\b(?:at|to|for)\b/gi, '').trim()
      }
    }

    if (!merchant) return null

    // Extract date hint
    let dateHint = 'today'
    if (lower.includes('yesterday')) dateHint = 'yesterday'
    else if (lower.match(/\d+\s+days?\s+ago/)) dateHint = lower.match(/\d+\s+days?\s+ago/)[0]
    else if (lower.match(/\d+\s+weeks?\s+ago/)) dateHint = lower.match(/\d+\s+weeks?\s+ago/)[0]
    else if (lower.match(/\d+\s+months?\s+ago/)) dateHint = lower.match(/\d+\s+months?\s+ago/)[0]

    return {
      amount,
      merchant,
      dateHint
    }
  }

  /**
   * Handle update command with smart context awareness
   */
  async handleUpdate(userMessage, expenseData) {
    console.log('✅ UPDATE command detected')

    // Extract expenses array properly
    const expenses = expenseData?.expenses || []

    const updates = {}
    let query = ''

    // Extract target expense
    if (userMessage.toLowerCase().includes('most recent') || 
        userMessage.toLowerCase().includes('latest') || 
        userMessage.toLowerCase().includes('last')) {
      query = 'most_recent'
      console.log('📍 Target: most recent')
    } else {
      // Check conversation history for context
      const recentMessages = this.memory.getConversationHistory().slice(-6)
      let contextMerchant = null

      // Look for merchant mentions in recent conversation
      for (const msg of recentMessages.reverse()) {
        if (msg.role === 'user') {
          for (const exp of expenses) {
            if (msg.content.toLowerCase().includes(exp.merchant.toLowerCase())) {
              contextMerchant = exp.merchant.toLowerCase()
              break
            }
          }
          if (contextMerchant) break
        }
      }

      // Try current message first
      for (const exp of expenses) {
        if (userMessage.toLowerCase().includes(exp.merchant.toLowerCase())) {
          query = exp.merchant.toLowerCase()
          console.log('📍 Target merchant (current message):', exp.merchant)
          break
        }
      }

      // Fallback to context
      if (!query && contextMerchant) {
        query = contextMerchant
        console.log('📍 Target merchant (from context):', contextMerchant)
      }
    }

    // Extract new amount
    const amountPatterns = [
      /\$(\d+(?:\.\d{2})?)/,
      /(\d+(?:\.\d{2})?)\s*dollars?/i,
      /to\s+(\d+(?:\.\d{2})?)/i,
      /(\d+)\s*even/i
    ]

    for (const pattern of amountPatterns) {
      const match = userMessage.match(pattern)
      if (match) {
        updates.amount = parseFloat(match[1])
        console.log('💰 New amount:', updates.amount)
        break
      }
    }

    if (query && Object.keys(updates).length > 0) {
      console.log('🚀 Executing update:', { query, updates })
      const result = await this.tools.update_expense({ query, updates })
      return { 
        handled: true, 
        response: result.success 
          ? `✅ Updated expense to $${updates.amount}!` 
          : `❌ Failed to update: ${result.error}`
      }
    }

    console.log('❌ Incomplete update command:', { query, updates })
    return { handled: false }
  }

  /**
   * Build messages array for OpenAI with emotional context
   */
  buildMessages(systemPrompt, userMessage) {
    const conversationHistory = this.memory.getConversationHistory()

    return [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-10), // Last 10 messages for context
      { role: 'user', content: userMessage }
    ]
  }
}

export default NovaAgent
