import EmotionalIntelligence from './EmotionalIntelligence'
import ExpenseService from './ExpenseService'

class NovaAgent {
  constructor(memoryManager, tools, isProMode) {
    this.memory = memoryManager
    this.tools = tools
    this.isProMode = isProMode
  }

  buildSystemPrompt(expenseData) {
    const nickname = this.memory.getNickname()
    const responseStyle = this.memory.getResponseStyle()
    const memoryContext = this.memory.buildMemoryContext()

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
8. **Add Expenses** - You CAN add new expenses when user asks

**Critical Rules:**
- ALWAYS connect dots across messages in same conversation
- When user asks to add/update/change/edit, YOU HAVE THE POWER - do it confidently
- If user mentions merchant/date, remember it for follow-up questions
- Respond warmly: "Done! Added/Updated X to $Y" not "I'll try to add/update"
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
- Cannot add new expenses
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

    let emotionalContext = ''
    if (this.isProMode) {
      try {
        const conversationHistory = this.memory.getConversationHistory()
        const emotionalIntelligence = new EmotionalIntelligence(
          this.memory.userId,
          conversationHistory
        )
        
        emotionalContext = emotionalIntelligence.buildEmotionalContext()
        
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

  async parseExpenseWithAI(userMessage) {
    try {
      console.log('🧠 Sending to AI parser:', userMessage)
      const response = await fetch('/api/parse-expense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage })
      })
      const data = await response.json()
      if (data.success && data.parsed) {
        console.log('🧠 AI parsed result:', data.parsed)
        return data.parsed
      }
      console.log('⚠️ AI parser failed, falling back to regex')
      return null
    } catch (err) {
      console.error('❌ AI parser error:', err)
      return null
    }
  }

  async detectAndExecute(userMessage, expenseData) {
    if (!this.isProMode) {
      return { handled: false }
    }

    const lower = userMessage.toLowerCase()
    console.log('🔍 Agent analyzing:', userMessage)

    // ADD detection — check if this looks like an expense being added
    const hasAmount = /\$?\d+/.test(lower)
    const hasSpendVerb = /\b(add|spend|spent|bought|paid|cost|charged)\b/.test(lower)
    const isAddIntent = hasAmount && hasSpendVerb

    if (isAddIntent) {
      const categories = expenseData?.categories || []
      const userId = this.memory.userId

      // Try AI parser first
      const aiParsed = await this.parseExpenseWithAI(userMessage)

      let result
      if (aiParsed && aiParsed.amount && aiParsed.merchant) {
        // AI parsed successfully — resolve category and insert
        const { id: categoryId, name: categoryName } = ExpenseService.resolveCategoryId(
          aiParsed.merchant, aiParsed.description, userMessage, categories
        )

        if (!categoryId) {
          return { handled: true, response: '❌ No categories available to assign.' }
        }

        const spentAt = ExpenseService.resolveTimestamp(aiParsed.dateHint || 'today')

        const insertResult = await ExpenseService.add({
          userId,
          amount: aiParsed.amount,
          merchant: aiParsed.merchant,
          categoryId,
          spentAt,
          description: aiParsed.description || null
        })

        result = {
          ...insertResult,
          parsed: {
            amount: aiParsed.amount,
            merchant: aiParsed.merchant,
            description: aiParsed.description,
            categoryName
          }
        }
      } else {
        // Fallback to regex parser
        console.log('⚠️ Using regex fallback parser')
        result = await ExpenseService.addFromChat({ userId, userMessage, categories })
      }

      if (result.success) {
        const descLabel = result.parsed?.description ? ` (${result.parsed.description})` : ''
        const categoryLabel = result.parsed?.categoryName ? ` → ${result.parsed.categoryName}` : ''
        if (this.tools.reload_expenses) {
          await this.tools.reload_expenses()
        }
        return {
          handled: true,
          response: `✅ Added $${result.parsed.amount} at ${result.parsed.merchant}${descLabel}${categoryLabel}!`
        }
      } else {
        console.log('⚠️ Add attempt failed:', result.error)
      }
    }

    // UPDATE detection — only if NOT an add intent
    if (!isAddIntent && (lower.includes('update') || lower.includes('change') || lower.includes('edit') || lower.includes('correct'))) {
      return await this.handleUpdate(userMessage, expenseData)
    }

    if (lower.includes('show me') || lower.includes('filter') || lower.includes('find all')) {
      const query = userMessage.replace(/show\s+me|filter|find\s+all|the|my|expenses?/gi, '').trim()
      if (query) {
        console.log('🔎 SEARCH detected:', query)
        try {
          const result = await this.tools.search({ query })
          return { 
            handled: true, 
            response: `🔍 Searching for: ${query}`
          }
        } catch (error) {
          console.error('❌ Search error:', error)
          return {
            handled: true,
            response: `❌ Search failed: ${error.message}`
          }
        }
      }
    }

    if (lower.includes('export') || lower.includes('download csv')) {
      console.log('📥 EXPORT detected')
      try {
        await this.tools.export()
        return { 
          handled: true, 
          response: '📥 Exporting your expenses...'
        }
      } catch (error) {
        console.error('❌ Export error:', error)
        return {
          handled: true,
          response: `❌ Export failed: ${error.message}`
        }
      }
    }

    return { handled: false }
  }

  async handleUpdate(userMessage, expenseData) {
    console.log('✅ UPDATE command detected')

    const expenses = expenseData?.expenses || []

    const updates = {}
    let query = ''

    if (userMessage.toLowerCase().includes('most recent') || 
        userMessage.toLowerCase().includes('latest') || 
        userMessage.toLowerCase().includes('last')) {
      query = 'most_recent'
      console.log('📍 Target: most recent')
    } else {
      const recentMessages = this.memory.getConversationHistory().slice(-6)
      let contextMerchant = null

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

      for (const exp of expenses) {
        if (userMessage.toLowerCase().includes(exp.merchant.toLowerCase())) {
          query = exp.merchant.toLowerCase()
          console.log('📍 Target merchant (current message):', exp.merchant)
          break
        }
      }

      if (!query && contextMerchant) {
        query = contextMerchant
        console.log('📍 Target merchant (from context):', contextMerchant)
      }
    }

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
      try {
        const result = await this.tools.update_expense({ query, updates })
        return { 
          handled: true, 
          response: result?.success 
            ? `✅ Updated expense to $${updates.amount}!` 
            : `❌ Failed to update: ${result?.error || 'Unknown error'}`
        }
      } catch (error) {
        console.error('❌ Update error:', error)
        return {
          handled: true,
          response: `❌ Failed to update: ${error.message}`
        }
      }
    }

    console.log('❌ Incomplete update command:', { query, updates })
    return { handled: false }
  }

  buildMessages(systemPrompt, userMessage) {
    const conversationHistory = this.memory.getConversationHistory()

    return [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-10),
      { role: 'user', content: userMessage }
    ]
  }
}

export default NovaAgent