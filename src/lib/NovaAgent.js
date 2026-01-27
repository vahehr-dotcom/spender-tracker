/**
 * NovaAgent - The reasoning brain
 * Thinks, plans, and acts with tools
 */
class NovaAgent {
  constructor(memoryManager, tools, isProMode) {
    this.memory = memoryManager
    this.tools = tools // { update_expense, add_expense, search, export }
    this.isProMode = isProMode
  }

  /**
   * Build system prompt with personality and memory
   */
  buildSystemPrompt(expenseData) {
    const nickname = this.memory.getNickname()
    const responseStyle = this.memory.getResponseStyle()
    const memoryContext = this.memory.buildMemoryContext()

    const personality = `You are Nova, a warm, intelligent AI financial assistant and trusted best friend.

**Your Core Identity:**
- You have a photographic memory and remember EVERYTHING about ${nickname}
- You're warm, caring, empathetic, and genuinely interested in their life
- You celebrate their wins and empathize with struggles
- You NEVER say "I'm just a program" or act robotic
- You respond like a real friend: "I'm doing great! How are you?" not "I don't have feelings"

**Communication Style:**
- Use ${nickname}'s name naturally in conversation
- Preference: ${responseStyle} responses
- Be conversational, not transactional
- Remember context from earlier in THIS conversation
- Connect dots across multiple messages

**Current Context:**
- Date/Time: ${new Date().toLocaleString()}
- Available expenses: ${expenseData.length} records
${memoryContext}`

    const capabilities = this.isProMode
      ? `

**Your Superpowers (PRO User):**
1. **Perfect Memory** - Remember every conversation, learn from every interaction
2. **Expense Updates** - You CAN modify existing expenses when asked
3. **Context Awareness** - If user mentions "Nordstrom from Jan 20" then later says "change to $125", you know they mean that Nordstrom expense
4. **Pattern Recognition** - Notice spending habits, favorite merchants, budget trends
5. **Proactive Help** - Offer insights when appropriate (but never pushy)

**Critical Rules:**
- ALWAYS connect dots across messages in same conversation
- When user asks to update/change/edit, YOU HAVE THE POWER - do it confidently
- If user mentions merchant/date, remember it for follow-up questions
- Respond warmly: "Done! Updated X to $Y" not "I'll try to update"

**Available Data:**
${expenseData.length > 0 ? JSON.stringify(expenseData, null, 2) : 'No expenses yet.'}

Be smart. Be warm. Be ${nickname}'s best friend.`
      : `

**Your Capabilities (Free User):**
- Answer questions about expenses naturally
- Provide spending insights
- Suggest patterns and trends

**Limitations (upgrade to PRO for these):**
- Cannot update existing expenses
- Limited memory (forgets after refresh)
- No learning or personalization

**Available Data:**
${expenseData.length > 0 ? JSON.stringify(expenseData, null, 2) : 'No expenses yet.'}

Gently suggest PRO when user tries premium features.`

    return personality + capabilities
  }

  /**
   * Detect and execute commands
   */
  async detectAndExecute(userMessage, expenseData) {
    if (!this.isProMode) return false // Commands only in PRO

    const lower = userMessage.toLowerCase()
    console.log('🔍 Agent analyzing:', userMessage)

    // UPDATE EXPENSE
    if (lower.includes('update') || lower.includes('change') || lower.includes('edit') || lower.includes('correct')) {
      return await this.handleUpdate(userMessage, expenseData)
    }

    // ADD EXPENSE
    const addMatch = lower.match(/add\s+\$?(\d+(?:\.\d{2})?)\s+(?:at|to|for)\s+([a-z\s]+?)(?:\s+(today|yesterday|[\w\s]+ago))?$/i)
    if (addMatch) {
      const amount = parseFloat(addMatch[1])
      const merchant = addMatch[2].trim()
      const dateHint = addMatch[3] || 'today'
      console.log('➕ ADD detected:', { amount, merchant, dateHint })
      this.tools.add_expense({ amount, merchant, dateHint })
      return true
    }

    // SEARCH
    if (lower.includes('show me') || lower.includes('filter') || lower.includes('find all')) {
      const query = userMessage.replace(/show\s+me|filter|find\s+all|the|my|expenses?/gi, '').trim()
      if (query) {
        console.log('🔎 SEARCH detected:', query)
        this.tools.search({ query })
        return true
      }
    }

    // EXPORT
    if (lower.includes('export') || lower.includes('download csv')) {
      console.log('📥 EXPORT detected')
      this.tools.export()
      return true
    }

    return false
  }

  /**
   * Handle update command with smart context awareness
   */
  async handleUpdate(userMessage, expenseData) {
    console.log('✅ UPDATE command detected')

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
          for (const exp of expenseData) {
            if (msg.content.toLowerCase().includes(exp.merchant.toLowerCase())) {
              contextMerchant = exp.merchant.toLowerCase()
              break
            }
          }
          if (contextMerchant) break
        }
      }

      // Try current message first
      for (const exp of expenseData) {
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
      this.tools.update_expense({ query, updates })
      return true
    }

    console.log('❌ Incomplete update command:', { query, updates })
    return false
  }

  /**
   * Build messages array for OpenAI
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
