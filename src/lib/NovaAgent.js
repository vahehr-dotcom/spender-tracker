import EmotionalIntelligence from './EmotionalIntelligence'
import ExpenseService from './ExpenseService'
import CategoryResolver from './CategoryResolver'
import SpendingInsights from './SpendingInsights'

class NovaAgent {
  constructor(memoryManager, tools, isProMode) {
    this.memory = memoryManager
    this.tools = tools
    this.isProMode = isProMode
    this.pendingExpense = null
  }

  isSimilar(a, b) {
    if (!a || !b) return true
    const aWords = a.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2)
    const bWords = b.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2)
    const aInB = aWords.filter(w => bWords.some(bw => bw.includes(w) || w.includes(bw)))
    return aInB.length >= Math.ceil(aWords.length * 0.5)
  }

  buildExpenseLabel(parsed) {
    const merchant = parsed?.merchant || ''
    const desc = parsed?.description || ''
    const category = parsed?.categoryName || ''

    const isDuplicate = !desc || this.isSimilar(merchant, desc)

    const descLabel = isDuplicate ? '' : ` (${desc})`
    const categoryLabel = category ? ` under ${category}` : ''

    return { descLabel, categoryLabel }
  }

  async buildSystemPrompt(expenseData) {
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
- Keep responses concise — 2-3 sentences for simple questions, never use bullet points unless asked
- Sound like a real person texting, not a report generator

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
- When you have spending insights, weave them naturally into conversation — don't dump data
- If you notice a spending spike, mention it casually like a friend would: "By the way, looks like dining's been adding up this week"

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

    let spendingContext = ''
    if (this.isProMode && this.memory.userId) {
      try {
        spendingContext = await SpendingInsights.buildInsightsForNova(this.memory.userId)
        if (spendingContext) {
          console.log('📊 Spending insights loaded for Nova')
        }
      } catch (err) {
        console.error('❌ SpendingInsights error:', err)
      }
    }

    return personality + capabilities + emotionalContext + spendingContext
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
      console.log('⚠️ AI parser returned no result')
      return null
    } catch (err) {
      console.error('❌ AI parser error:', err)
      return null
    }
  }

  async getProactiveAlert(userId, categoryName) {
    try {
      const alerts = await SpendingInsights.getWeeklyAlerts(userId)
      const relevant = alerts.find(a => a.includes(categoryName))
      if (relevant) {
        return `\n\n📊 Heads up — ${relevant}`
      }
    } catch (err) {
      console.warn('⚠️ Proactive alert check failed:', err)
    }
    return ''
  }

  async addExpense(parsed, expenseData) {
    const categories = expenseData?.categories || []
    const userId = this.memory.userId

    const resolved = await CategoryResolver.resolve({
      merchant: parsed.merchant,
      description: parsed.description,
      fullMessage: '',
      categories,
      userId
    })

    if (!resolved.id) {
      return { success: false, error: 'No categories available' }
    }

    const spentAt = ExpenseService.resolveTimestamp(parsed.dateHint || 'today')

    const insertResult = await ExpenseService.add({
      userId,
      amount: parsed.amount,
      merchant: parsed.merchant,
      categoryId: resolved.id,
      spentAt,
      description: parsed.description || null
    })

    if (insertResult.success && insertResult.data) {
      CategoryResolver.log(
        userId, insertResult.data.id, parsed.merchant,
        resolved.name, resolved.resolvedBy, resolved.confidence
      ).catch(() => {})
    }

    return {
      ...insertResult,
      parsed: {
        amount: parsed.amount,
        merchant: parsed.merchant,
        description: parsed.description,
        categoryName: resolved.name
      }
    }
  }

  async detectAndExecute(userMessage, expenseData) {
    if (!this.isProMode) {
      return { handled: false }
    }

    const lower = userMessage.toLowerCase()
    console.log('🔍 Agent analyzing:', userMessage)

    // Check if user is confirming a pending expense suggestion
    if (this.pendingExpense) {
      const isYes = /\b(yes|yeah|yep|yup|sure|ok|okay|do it|go ahead|add it|please|confirm)\b/.test(lower)
      const isNo = /\b(no|nah|nope|don't|cancel|skip|never\s*mind)\b/.test(lower)

      if (isYes) {
        const pending = this.pendingExpense
        this.pendingExpense = null

        const result = await this.addExpense(pending, expenseData)

        if (result.success) {
          const { descLabel, categoryLabel } = this.buildExpenseLabel(result.parsed)
          if (this.tools.reload_expenses) {
            await this.tools.reload_expenses()
          }

          let alert = ''
          if (result.parsed?.categoryName) {
            alert = await this.getProactiveAlert(this.memory.userId, result.parsed.categoryName)
          }

          return {
            handled: true,
            response: `✅ Done! Added $${result.parsed.amount} at ${result.parsed.merchant}${descLabel}${categoryLabel}!${alert}`
          }
        } else {
          return { handled: true, response: `❌ Failed to add: ${result.error}` }
        }
      } else if (isNo) {
        this.pendingExpense = null
        return { handled: true, response: 'No problem, I won\'t add it. 👍' }
      }
      // If neither yes nor no, clear pending and continue normally
      this.pendingExpense = null
    }

    // Only send to AI parser if message contains a number (potential expense)
    const hasNumber = /\d/.test(userMessage)
    const aiParsed = hasNumber ? await this.parseExpenseWithAI(userMessage) : null

    if (aiParsed && aiParsed.intent === 'add' && aiParsed.amount && aiParsed.merchant) {
      // Direct add — user clearly wants to add
      console.log('💰 ADD intent detected:', aiParsed)

      const result = await this.addExpense(aiParsed, expenseData)

      if (result.success) {
        const { descLabel, categoryLabel } = this.buildExpenseLabel(result.parsed)
        if (this.tools.reload_expenses) {
          await this.tools.reload_expenses()
        }

        let alert = ''
        if (result.parsed?.categoryName) {
          alert = await this.getProactiveAlert(this.memory.userId, result.parsed.categoryName)
        }

        return {
          handled: true,
          response: `✅ Added $${result.parsed.amount} at ${result.parsed.merchant}${descLabel}${categoryLabel}!${alert}`
        }
      } else {
        console.log('⚠️ Add attempt failed:', result.error)
        const parsed = ExpenseService.parseCommand(userMessage)
        if (parsed) {
          const fallbackResult = await this.addExpense(parsed, expenseData)
          if (fallbackResult.success) {
            const { descLabel, categoryLabel } = this.buildExpenseLabel(fallbackResult.parsed)
            if (this.tools.reload_expenses) {
              await this.tools.reload_expenses()
            }
            return {
              handled: true,
              response: `✅ Added $${fallbackResult.parsed.amount} at ${fallbackResult.parsed.merchant}${descLabel}${categoryLabel}!`
            }
          }
        }
      }
    }

    if (aiParsed && aiParsed.intent === 'suggest' && aiParsed.amount && aiParsed.merchant) {
      console.log('💬 SUGGEST intent detected:', aiParsed)

      const categories = expenseData?.categories || []
      const resolved = await CategoryResolver.resolve({
        merchant: aiParsed.merchant,
        description: aiParsed.description,
        fullMessage: userMessage,
        categories,
        userId: this.memory.userId
      })

      const categoryName = resolved?.name || 'Miscellaneous'

      this.pendingExpense = {
        amount: aiParsed.amount,
        merchant: aiParsed.merchant,
        description: aiParsed.description,
        dateHint: aiParsed.dateHint
      }

      const isDuplicate = !aiParsed.description || this.isSimilar(aiParsed.merchant, aiParsed.description)
      const descLabel = isDuplicate ? '' : ` for ${aiParsed.description}`
      const reaction = aiParsed.amount >= 500 ? `That's a big one! ` : ''

      return {
        handled: true,
        response: `${reaction}$${aiParsed.amount} for ${aiParsed.merchant}${descLabel}. Want me to add that to your expenses under ${categoryName}?`
      }
    }

    // BUDGET detection
    const isBudgetIntent = /\b(budget|limit|goal|cap|target)\b/.test(lower)
    if (isBudgetIntent && this.isProMode) {
      const setMatch = lower.match(/(?:set|make|change|update)\s+(?:my\s+)?(.+?)\s+(?:budget|limit|goal|cap|target)\s+(?:to|at|for|as)\s+\$?(\d+(?:\.\d{2})?)/)
        || lower.match(/(?:budget|limit|goal|cap|target)\s+(?:for|on)\s+(.+?)\s+(?:to|at|is|should be)\s+\$?(\d+(?:\.\d{2})?)/)
        || lower.match(/\$(\d+(?:\.\d{2})?)\s+(?:budget|limit|goal|cap|target)\s+(?:for|on)\s+(.+)/)

      if (setMatch) {
        let category, amount
        if (/^\d/.test(setMatch[1])) {
          amount = parseFloat(setMatch[1])
          category = setMatch[2].trim()
        } else {
          category = setMatch[1].trim()
          amount = parseFloat(setMatch[2])
        }

        // Fuzzy match category name against available categories
        const categories = expenseData?.categories || []
        const match = categories.find(c => c.name.toLowerCase() === category.toLowerCase())
          || categories.find(c => c.name.toLowerCase().includes(category.toLowerCase()))
          || categories.find(c => category.toLowerCase().includes(c.name.toLowerCase()))

        if (match) {
          const result = await SpendingInsights.setBudgetGoal(this.memory.userId, match.name, amount)
          if (result.success) {
            return { handled: true, response: `✅ Got it! ${match.name} budget set to $${amount}/month.` }
          }
        } else {
          return { handled: true, response: `I couldn't find a category matching "${category}". Try the exact category name.` }
        }
      }

      const removeMatch = lower.match(/(?:remove|delete|clear)\s+(?:my\s+)?(.+?)\s+(?:budget|limit|goal)/)
      if (removeMatch) {
        const category = removeMatch[1].trim()
        const categories = expenseData?.categories || []
        const match = categories.find(c => c.name.toLowerCase() === category.toLowerCase())
          || categories.find(c => c.name.toLowerCase().includes(category.toLowerCase()))

        if (match) {
          await SpendingInsights.removeBudgetGoal(this.memory.userId, match.name)
          return { handled: true, response: `✅ Removed your ${match.name} budget goal.` }
        }
      }

      // If just asking about budgets, let it fall through to chat — Nova has the data in her system prompt
    }

    // UPDATE detection
    if (lower.includes('update') || lower.includes('change') || lower.includes('edit') || lower.includes('correct')) {
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