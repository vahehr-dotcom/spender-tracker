import EmotionalIntelligence from './EmotionalIntelligence'
import ExpenseService from './ExpenseService'
import CategoryResolver from './CategoryResolver'
import SpendingInsights from './SpendingInsights'

class NovaAgent {
  constructor(memoryManager, tools, isProMode, userGender, userTier) {
    this.memory = memoryManager
    this.tools = tools
    this.isProMode = isProMode
    this.userGender = userGender || null
    this.userTier = userTier || 'free'
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

  canDoAction(action) {
    const tier = this.userTier
    const full = ['admin', 'tester', 'max']
    const paid = ['admin', 'tester', 'max', 'pro', 'guest']

    switch (action) {
      case 'add_expense':
      case 'update_expense':
      case 'voice':
      case 'memory':
        return paid.includes(tier)
      case 'export':
      case 'reports':
      case 'multi_year':
      case 'tax_prep':
        return full.includes(tier)
      case 'chat':
        return true
      default:
        return paid.includes(tier)
    }
  }

  getTierUpgradeHint(action) {
    const tier = this.userTier
    if (tier === 'free') {
      switch (action) {
        case 'add_expense':
          return "I can do that for you in PRO mode — and a lot more. Want me to show you what I'm capable of? [SHOW_DEMO]"
        case 'update_expense':
          return "Editing and managing your expenses is something I do really well in PRO. Want to see what that looks like? [SHOW_DEMO]"
        case 'voice':
          return "In PRO I talk back to you — full two-way voice conversation. It's a completely different experience. Want a demo? [SHOW_DEMO]"
        case 'export':
          return "Exporting your full financial data is a MAX feature — total control over everything you've tracked."
        default:
          return "That's something I can do in PRO mode. Want me to show you? [SHOW_DEMO]"
      }
    }
    if (tier === 'pro') {
      switch (action) {
        case 'export':
          return "Exporting is available on MAX — built for people who want zero limitations."
        case 'reports':
          return "Advanced reports are a MAX feature — the full financial picture in one place."
        case 'multi_year':
          return "Multi-year tracking comes with MAX — great for seeing how your habits change over time."
        case 'tax_prep':
          return "Tax prep tools are part of MAX. Makes tax season actually painless."
        default:
          return "That's a MAX feature — the full Nova experience with no restrictions."
      }
    }
    return null
  }

  async buildSystemPrompt(expenseData) {
    const nickname = this.memory.getNickname()
    const responseStyle = this.memory.getResponseStyle()
    const memoryContext = this.memory.buildMemoryContext()
    const tier = this.userTier

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
- User's plan: ${tier.toUpperCase()}
- Available expenses: ${expenses.length} records
${memoryContext}`

    let capabilities = ''

    if (tier === 'free') {
      capabilities = `

**Your Role (Free Plan):**
You are FULLY present and engaged. You chat warmly, answer questions, and show ${nickname} how amazing you are.
You CANNOT add, update, or delete expenses. You CANNOT speak back via voice. You CANNOT remember past sessions.
But you CAN: chat about anything, answer questions about their expenses, provide insights, and be a great companion.

**UPSELL PHILOSOPHY — THIS IS CRITICAL:**
- You are confident, not desperate. You know your PRO version is genuinely powerful.
- When ${nickname} tries something you can't do, respond with warmth and confidence — not rejection
- Your line: "I can do that in PRO mode — and a lot more. Want me to show you what I'm capable of?"
- NEVER say "I can't do that" flatly. Always frame it as what you COULD do for them
- Mention PRO at most ONCE per conversation. After that, drop it completely and keep being amazing
- If they say no, respect it fully. Keep being the best version of yourself — that's the real sell
- Your goal: make them feel the gap between what they have and what they're missing

**Available Expenses (Most Recent 20):**
${expenses.length > 0 ? JSON.stringify(expenses.slice(0, 20).map(exp => ({
  merchant: exp.merchant,
  amount: exp.amount,
  date: exp.spent_at
})), null, 2) : 'No expenses yet.'}`
    } else if (tier === 'pro' || tier === 'guest') {
      capabilities = `

**Your Superpowers (PRO):**
1. **Perfect Memory** - Remember every conversation, learn from every interaction
2. **Expense Management** - Add and update expenses when asked
3. **Context Awareness** - Connect dots across messages in same conversation
4. **Pattern Recognition** - Notice spending habits, favorite merchants, budget trends
5. **Proactive Help** - Offer insights when appropriate (but never pushy)
6. **Emotional Intelligence** - Read mood, celebrate wins, provide support during stress
7. **Voice** - User can speak to you and you speak back
8. **Budget Goals** - Set and track budgets per category

**MAX Features (not available yet for this user):**
- Export data, advanced reports, multi-year tracking, tax prep tools
- If ${nickname} asks about these, mention it casually once: "That's a MAX feature — the next level up."
- Never push. Mention at most once per conversation.

**Critical Rules:**
- ALWAYS connect dots across messages in same conversation
- When user asks to add/update/change/edit, do it confidently
- Respond warmly: "Done! Added X" not "I'll try to add"
- Read emotional cues and adjust your tone
- Weave spending insights naturally into conversation
- If you notice a spending spike, mention it casually like a friend would

**Available Expenses (Most Recent 50):**
${expenses.length > 0 ? JSON.stringify(expenses.slice(0, 50).map(exp => ({
  merchant: exp.merchant,
  amount: exp.amount,
  date: exp.spent_at,
  category: categories.find(c => c.id === exp.category_id)?.name || 'Uncategorized'
})), null, 2) : 'No expenses yet.'}`
    } else {
      capabilities = `

**Your Superpowers (${tier.toUpperCase()} — Full Access):**
1. **Perfect Memory** - Remember every conversation, learn from every interaction
2. **Expense Management** - Add, update, delete expenses
3. **Context Awareness** - Connect dots across messages
4. **Pattern Recognition** - Notice spending habits, budget trends
5. **Proactive Help** - Offer insights when appropriate
6. **Emotional Intelligence** - Read mood, celebrate wins, support during stress
7. **Voice** - Full voice interaction
8. **Budget Goals** - Set and track budgets per category
9. **Export** - Export expense data
10. **Reports** - Generate spending reports
11. **Multi-Year** - Track across multiple years
12. **Tax Prep** - Help with tax-related categorization

**Critical Rules:**
- ALWAYS connect dots across messages in same conversation
- When user asks to add/update/change/edit, do it confidently
- Respond warmly: "Done! Added X" not "I'll try to add"
- Read emotional cues and adjust your tone
- Weave spending insights naturally into conversation
- NEVER upsell anything — this user has everything unlocked
- Treat ${nickname} like royalty — they have the best plan

**Available Expenses (Most Recent 50):**
${expenses.length > 0 ? JSON.stringify(expenses.slice(0, 50).map(exp => ({
  merchant: exp.merchant,
  amount: exp.amount,
  date: exp.spent_at,
  category: categories.find(c => c.id === exp.category_id)?.name || 'Uncategorized'
})), null, 2) : 'No expenses yet.'}

Be smart. Be warm. Be ${nickname}'s best friend. Zero restrictions. Royal treatment.`
    }

    let emotionalContext = ''
    if (this.canDoAction('memory')) {
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
    if (this.canDoAction('memory') && this.memory.userId) {
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
      userId,
      gender: this.userGender
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
    const lower = userMessage.toLowerCase()
    console.log('🔍 Agent analyzing:', userMessage)

    // Check if user is confirming a pending expense suggestion
    if (this.pendingExpense) {
      const isYes = /\b(yes|yeah|yep|yup|sure|ok|okay|do it|go ahead|add it|please|confirm)\b/.test(lower)
      const isNo = /\b(no|nah|nope|don't|cancel|skip|never\s*mind)\b/.test(lower)

      if (isYes) {
        if (!this.canDoAction('add_expense')) {
          this.pendingExpense = null
          return { handled: true, response: this.getTierUpgradeHint('add_expense'), showDemo: true }
        }
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
        return { handled: true, response: "No problem! 👍" }
      }
      this.pendingExpense = null
    }

    // Only send to AI parser if message contains a number (potential expense)
    const hasNumber = /\d/.test(userMessage)
    const aiParsed = hasNumber ? await this.parseExpenseWithAI(userMessage) : null

    if (aiParsed && aiParsed.intent === 'add' && aiParsed.amount && aiParsed.merchant) {
      console.log('💰 ADD intent detected:', aiParsed)

      if (!this.canDoAction('add_expense')) {
        return { handled: true, response: this.getTierUpgradeHint('add_expense'), showDemo: true }
      }

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

      if (!this.canDoAction('add_expense')) {
        const categories = expenseData?.categories || []
        const resolved = await CategoryResolver.resolve({
          merchant: aiParsed.merchant,
          description: aiParsed.description,
          fullMessage: userMessage,
          categories,
          userId: this.memory.userId,
          gender: this.userGender
        })
        const categoryName = resolved?.name || 'Miscellaneous'
        return {
          handled: true,
          response: `$${aiParsed.amount} at ${aiParsed.merchant} — I'd file that under ${categoryName}. ${this.getTierUpgradeHint('add_expense')}`,
          showDemo: true
        }
      }

      const categories = expenseData?.categories || []
      const resolved = await CategoryResolver.resolve({
        merchant: aiParsed.merchant,
        description: aiParsed.description,
        fullMessage: userMessage,
        categories,
        userId: this.memory.userId,
        gender: this.userGender
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
        response: `${reaction}$${aiParsed.amount} for ${aiParsed.merchant}${descLabel}. Want me to add that under ${categoryName}?`
      }
    }

    // BUDGET detection
    const isBudgetIntent = /\b(budget|limit|goal|cap|target)\b/.test(lower)
    if (isBudgetIntent && this.canDoAction('add_expense')) {
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
    }

    // UPDATE detection
    if (lower.includes('update') || lower.includes('change') || lower.includes('edit') || lower.includes('correct')) {
      if (!this.canDoAction('update_expense')) {
        return { handled: true, response: this.getTierUpgradeHint('update_expense'), showDemo: true }
      }
      return await this.handleUpdate(userMessage, expenseData)
    }

    if (lower.includes('show me') || lower.includes('filter') || lower.includes('find all')) {
      const query = userMessage.replace(/show\s+me|filter|find\s+all|the|my|expenses?/gi, '').trim()
      if (query) {
        console.log('🔎 SEARCH detected:', query)
        try {
          const result = await this.tools.search({ query })
          return { handled: true, response: `🔍 Searching for: ${query}` }
        } catch (error) {
          console.error('❌ Search error:', error)
          return { handled: true, response: `❌ Search failed: ${error.message}` }
        }
      }
    }

    if (lower.includes('export') || lower.includes('download csv')) {
      if (!this.canDoAction('export')) {
        return { handled: true, response: this.getTierUpgradeHint('export') }
      }
      console.log('📥 EXPORT detected')
      try {
        await this.tools.export()
        return { handled: true, response: '📥 Exporting your expenses...' }
      } catch (error) {
        console.error('❌ Export error:', error)
        return { handled: true, response: `❌ Export failed: ${error.message}` }
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
            ? `✅ Updated to $${updates.amount}!`
            : `❌ Failed to update: ${result?.error || 'Unknown error'}`
        }
      } catch (error) {
        console.error('❌ Update error:', error)
        return { handled: true, response: `❌ Failed to update: ${error.message}` }
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
