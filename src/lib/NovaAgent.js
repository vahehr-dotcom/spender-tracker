import EmotionalIntelligence from './EmotionalIntelligence'

const CATEGORY_KEYWORDS = {
  'Coffee & Tea': ['starbucks', 'coffee', 'cafe', 'latte', 'espresso', 'tea', 'boba', 'dutch bros', 'peets', 'dunkin'],
  'Groceries': ['grocery', 'groceries', 'costco', 'trader joe', 'whole foods', 'safeway', 'kroger', 'albertsons', 'ralphs', 'vons', 'aldi', 'sprouts', 'food4less'],
  'Dining Out': ['restaurant', 'dining', 'dinner', 'lunch', 'brunch', 'dine', 'ihop', 'applebee', 'chili', 'olive garden', 'cheesecake factory', 'chipotle', 'panera', 'subway', 'panda express'],
  'Bars & Drinks': ['bar', 'pub', 'brewery', 'wine', 'beer', 'cocktail', 'nightclub', 'lounge'],
  'Snacks & Convenience': ['snack', 'convenience', '7-eleven', '7eleven', 'circle k', 'ampm', 'wawa', 'sheetz'],
  'Gas & Fuel': ['gas', 'fuel', 'shell', 'chevron', 'exxon', 'mobil', 'bp', 'arco', 'costco gas', 'gasoline', 'texaco', '76'],
  'EV Charging': ['ev charging', 'supercharger', 'supercharging', 'tesla charging', 'chargepoint', 'electrify america', 'evgo', 'blink'],
  'Car Payment': ['car payment', 'auto payment', 'vehicle payment', 'car note'],
  'Car Insurance': ['car insurance', 'auto insurance', 'geico', 'progressive', 'state farm auto', 'allstate auto'],
  'Repairs & Maintenance': ['oil change', 'tire', 'brake', 'mechanic', 'auto repair', 'car wash', 'car repair', 'smog', 'alignment'],
  'Registration': ['registration', 'dmv', 'vehicle registration'],
  'Parking & Tolls': ['parking', 'toll', 'meter', 'fastrak', 'parkwhiz'],
  'Rent': ['rent', 'apartment rent'],
  'Mortgage': ['mortgage', 'home loan'],
  'Home Insurance': ['home insurance', 'homeowner insurance', 'renters insurance'],
  'Furniture & Decor': ['furniture', 'ikea', 'wayfair', 'crate and barrel', 'pottery barn', 'decor'],
  'Cleaning & Supplies': ['cleaning', 'supplies', 'paper towel', 'detergent', 'lysol'],
  'Electric': ['electric', 'electricity', 'edison', 'power bill', 'sce', 'pg&e'],
  'Water': ['water bill', 'water utility', 'water department'],
  'Internet': ['internet', 'wifi', 'spectrum', 'att internet', 'xfinity', 'comcast', 'frontier'],
  'Phone': ['phone bill', 'tmobile', 't-mobile', 'verizon', 'att phone', 'mint mobile', 'cricket'],
  'Trash & Sewer': ['trash', 'sewer', 'waste management', 'garbage'],
  'Doctor & Co-pay': ['doctor', 'copay', 'co-pay', 'physician', 'clinic', 'urgent care', 'kaiser'],
  'Pharmacy': ['pharmacy', 'cvs', 'walgreens', 'rite aid', 'prescription', 'medication', 'medicine'],
  'Dental': ['dentist', 'dental', 'orthodontist', 'teeth'],
  'Vision': ['eye doctor', 'optometrist', 'glasses', 'contacts', 'lenscrafters', 'vision'],
  'Mental Health': ['therapist', 'therapy', 'counseling', 'psychiatrist', 'mental health'],
  'Fitness & Gym': ['gym', 'fitness', 'planet fitness', 'la fitness', 'equinox', 'crossfit', 'yoga', 'peloton', '24 hour fitness'],
  'Amazon': ['amazon'],
  'eBay': ['ebay'],
  'General Online Retail': ['online order', 'shein', 'temu', 'wish', 'etsy', 'shopify'],
  'Digital Purchases': ['itunes', 'google play', 'digital', 'download', 'ebook'],
  'App Purchases': ['app store', 'in-app', 'app purchase'],
  'Streaming': ['netflix', 'hulu', 'disney+', 'disney plus', 'hbo', 'max', 'paramount', 'peacock', 'apple tv', 'youtube premium', 'spotify', 'pandora', 'tidal'],
  'Movies & Events': ['movie', 'cinema', 'amc', 'regal', 'concert', 'event', 'tickets', 'ticketmaster', 'stubhub', 'live nation'],
  'Games': ['game', 'playstation', 'xbox', 'nintendo', 'steam', 'gaming'],
  'Books & Music': ['book', 'kindle', 'audible', 'barnes noble', 'music'],
  'Apps & Software': ['software', 'subscription', 'adobe', 'microsoft', 'dropbox', 'icloud', 'google one', 'chatgpt', 'openai'],
  'Memberships': ['membership', 'costco membership', 'sam club', 'amazon prime', 'prime membership'],
  'Meal Kits': ['hello fresh', 'blue apron', 'home chef', 'meal kit', 'factor'],
  'Fixed Bills': ['bill', 'payment due'],
  'Debt Payments': ['debt', 'loan payment'],
  'Credit Cards': ['credit card payment', 'visa payment', 'mastercard payment', 'amex payment', 'chase payment', 'capital one payment'],
  'Student Loans': ['student loan', 'student debt', 'navient', 'sallie mae', 'nelnet', 'mohela'],
  'Personal Loans': ['personal loan', 'sofi loan', 'lending club', 'prosper loan'],
  'Medical Debt': ['medical bill', 'hospital bill', 'medical debt', 'medical payment'],
  'Clothing & Shoes': ['clothing', 'clothes', 'shoes', 'nike', 'adidas', 'zara', 'h&m', 'nordstrom', 'ross', 'tjmaxx', 'marshalls', 'foot locker'],
  'Electronics': ['electronics', 'best buy', 'apple store', 'computer', 'laptop', 'phone case'],
  'Personal Care & Beauty': ['salon', 'haircut', 'barber', 'nails', 'spa', 'sephora', 'ulta', 'beauty'],
  'Home Goods': ['home goods', 'homegoods', 'bed bath', 'target home', 'home depot', 'lowes', 'ace hardware'],
  'General Retail': ['target', 'walmart', 'dollar tree', 'dollar general', 'five below', 'big lots'],
  'Childcare': ['daycare', 'childcare', 'babysitter', 'nanny'],
  'School & Tuition': ['tuition', 'school', 'university', 'college', 'education'],
  'Activities': ['soccer', 'baseball', 'dance class', 'piano', 'karate', 'swim class', 'camp', 'kids activity'],
  'Kids Clothing': ['kids clothes', 'children clothing', 'carter', 'oshkosh', 'gap kids', 'old navy kids'],
  'Pet Food': ['pet food', 'dog food', 'cat food', 'chewy'],
  'Vet': ['vet', 'veterinarian', 'animal hospital', 'pet doctor'],
  'Grooming': ['pet grooming', 'dog grooming', 'cat grooming'],
  'Pet Supplies': ['pet supplies', 'petco', 'petsmart', 'pet store'],
  'Pet Insurance': ['pet insurance', 'trupanion', 'embrace pet'],
  'Flights': ['flight', 'airline', 'airfare', 'united', 'delta', 'southwest', 'american airlines', 'jetblue', 'spirit airlines'],
  'Hotels & Lodging': ['hotel', 'motel', 'airbnb', 'vrbo', 'lodging', 'resort', 'marriott', 'hilton', 'hyatt'],
  'Night Life': ['nightlife', 'night out', 'club', 'lounge', 'happy hour'],
  'Weekend Trips': ['weekend trip', 'road trip', 'getaway', 'day trip'],
  'Vacation Activities': ['excursion', 'tour', 'sightseeing', 'attraction', 'theme park', 'disneyland', 'disney world', 'universal studios'],
  'Miscellaneous': ['lotto', 'lottery', 'gift card', 'donation', 'charity', 'tip', 'birthday gift', 'holiday gift']
}

class NovaAgent {
  constructor(memoryManager, tools, isProMode) {
    this.memory = memoryManager
    this.tools = tools
    this.isProMode = isProMode
  }

  matchCategory(merchant) {
    const lower = merchant.toLowerCase()
    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      for (const keyword of keywords) {
        if (lower.includes(keyword)) {
          return category
        }
      }
    }
    return null
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

  async detectAndExecute(userMessage, expenseData) {
    if (!this.isProMode) {
      return { handled: false }
    }

    const lower = userMessage.toLowerCase()
    console.log('🔍 Agent analyzing:', userMessage)

    if (lower.includes('update') || lower.includes('change') || lower.includes('edit') || lower.includes('correct')) {
      return await this.handleUpdate(userMessage, expenseData)
    }

    if ((lower.includes('add') || lower.includes('spent')) && /\$?\d+/.test(lower)) {
      const parsed = this.parseAddCommand(userMessage)
      if (parsed) {
        console.log('➕ ADD detected:', parsed)
        try {
          const result = await this.tools.add_expense(parsed)
          const categoryLabel = parsed.categoryHint ? ` → ${parsed.categoryHint}` : ''
          return { 
            handled: true, 
            response: result?.success 
              ? `✅ Added $${parsed.amount} at ${parsed.merchant}${categoryLabel}!` 
              : `❌ Failed to add expense: ${result?.error || 'Unknown error'}`
          }
        } catch (error) {
          console.error('❌ Add expense error:', error)
          return {
            handled: true,
            response: `❌ Failed to add expense: ${error.message}`
          }
        }
      }
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

  parseAddCommand(userMessage) {
    const lower = userMessage.toLowerCase()

    const amountMatch = lower.match(/\$?(\d+(?:\.\d{2})?)/)
    if (!amountMatch) return null
    const amount = parseFloat(amountMatch[1])

    let merchant = null
    
    const atMatch = userMessage.match(/(?:at|to|for|in)\s+([a-z0-9\s&'-]+?)(?:\s+(?:today|yesterday|on|last)|\s*$)/i)
    if (atMatch) {
      merchant = atMatch[1].trim()
    }
    
    if (!merchant) {
      const afterAmount = userMessage.replace(/(?:add|spent)\s+\$?\d+(?:\.\d{2})?/i, '').trim()
      const words = afterAmount.split(/\s+/).filter(w => 
        !['at', 'to', 'for', 'in', 'today', 'yesterday', 'on'].includes(w.toLowerCase())
      )
      if (words.length > 0) {
        merchant = words.join(' ')
      }
    }

    if (!merchant) {
      const betweenMatch = userMessage.match(/\$?\d+(?:\.\d{2})?\s+(.+?)(?:\s+(?:today|yesterday|[\w\s]+ago)|$)/i)
      if (betweenMatch) {
        merchant = betweenMatch[1].replace(/\b(?:at|to|for|in)\b/gi, '').trim()
      }
    }

    if (!merchant) return null

    let dateHint = 'today'
    if (lower.includes('yesterday')) dateHint = 'yesterday'
    else if (lower.match(/\d+\s+days?\s+ago/)) dateHint = lower.match(/\d+\s+days?\s+ago/)[0]
    else if (lower.match(/\d+\s+weeks?\s+ago/)) dateHint = lower.match(/\d+\s+weeks?\s+ago/)[0]
    else if (lower.match(/\d+\s+months?\s+ago/)) dateHint = lower.match(/\d+\s+months?\s+ago/)[0]

    const categoryHint = this.matchCategory(merchant) || this.matchCategory(userMessage)

    return {
      amount,
      merchant,
      dateHint,
      categoryHint
    }
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