import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../supabaseClient'

export default function ChatAssistant({
  expenses,
  categories,
  isProMode,
  onUpgradeToPro,
  onAICommand,
  userId
}) {
  const [aiInput, setAiInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [lastResponse, setLastResponse] = useState('')
  const [voiceTranscript, setVoiceTranscript] = useState('')

  const [conversationHistory, setConversationHistory] = useState([])
  const [userInsights, setUserInsights] = useState([])
  const [userPreferences, setUserPreferences] = useState({})

  const recognitionRef = useRef(null)
  const audioRef = useRef(null)
  const expensesRef = useRef(expenses)
  const categoriesRef = useRef(categories)

  useEffect(() => {
    expensesRef.current = expenses
  }, [expenses])

  useEffect(() => {
    categoriesRef.current = categories
  }, [categories])

  useEffect(() => {
    if (isProMode && userId) {
      loadUserProfile()
    }
  }, [isProMode, userId])

  const loadUserProfile = async () => {
    if (!userId) return

    try {
      const { data: conversations } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (conversations) {
        setConversationHistory(conversations)
      }

      const { data: insights } = await supabase
        .from('user_insights')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)

      if (insights) {
        setUserInsights(insights)
      }

      const { data: prefs } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)

      if (prefs) {
        const prefsObj = {}
        prefs.forEach(p => {
          prefsObj[p.preference_type] = p.preference_value
        })
        setUserPreferences(prefsObj)
      }
    } catch (err) {
      console.error('Error loading user profile:', err)
    }
  }

  const saveConversation = async (role, message) => {
    if (!isProMode || !userId) return

    try {
      await supabase.from('conversations').insert({
        user_id: userId,
        role,
        message
      })
    } catch (err) {
      console.error('Error saving conversation:', err)
    }
  }

  const extractInsights = (userMessage, aiResponse) => {
    const insights = []

    if (userMessage.toLowerCase().includes('my name is')) {
      const match = userMessage.match(/my name is (\w+)/i)
      if (match) {
        insights.push({
          type: 'preference',
          key: 'nickname',
          value: match[1]
        })
      }
    }

    if (userMessage.toLowerCase().includes('prefer short') || userMessage.toLowerCase().includes('keep it brief')) {
      insights.push({
        type: 'preference',
        key: 'response_style',
        value: 'concise'
      })
    }

    if (userMessage.toLowerCase().includes('prefer detailed') || userMessage.toLowerCase().includes('explain more')) {
      insights.push({
        type: 'preference',
        key: 'response_style',
        value: 'detailed'
      })
    }

    return insights
  }

  const saveInsightsAndPreferences = async (userMessage, aiResponse) => {
    if (!isProMode || !userId) return

    const insights = extractInsights(userMessage, aiResponse)

    for (const insight of insights) {
      if (insight.type === 'preference') {
        try {
          await supabase.from('user_preferences').upsert({
            user_id: userId,
            preference_type: insight.key,
            preference_value: insight.value
          }, {
            onConflict: 'user_id,preference_type'
          })

          setUserPreferences(prev => ({
            ...prev,
            [insight.key]: insight.value
          }))
        } catch (err) {
          console.error('Error saving preference:', err)
        }
      }
    }
  }

  useEffect(() => {
    if ('webkitSpeechRecognition' in window) {
      const recognition = new window.webkitSpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = 'en-US'

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript
        setVoiceTranscript(transcript)
        setAiInput(transcript)
        setIsListening(false)
        
        // AUTO-SUBMIT after voice input
        setTimeout(() => {
          handleAISubmit({ preventDefault: () => {} })
        }, 500)
      }

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error)
        setIsListening(false)
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognitionRef.current = recognition
    }
  }, [])

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      setVoiceTranscript('')
      recognitionRef.current.start()
      setIsListening(true)
    }
  }

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    }
  }

  const speak = async (text) => {
    if (!text) return

    setIsSpeaking(true)

    try {
      const res = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'tts-1',
          voice: 'nova',
          input: text
        })
      })

      if (!res.ok) throw new Error('TTS failed')

      const audioBlob = await res.blob()
      const audioUrl = URL.createObjectURL(audioBlob)

      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }

      const audio = new Audio(audioUrl)
      audioRef.current = audio

      audio.onended = () => {
        setIsSpeaking(false)
        URL.revokeObjectURL(audioUrl)
      }

      audio.onerror = () => {
        setIsSpeaking(false)
        URL.revokeObjectURL(audioUrl)
      }

      await audio.play()
    } catch (err) {
      console.error('TTS error:', err)
      setIsSpeaking(false)
    }
  }

  const clearChat = () => {
    if (window.confirm('Clear conversation history?')) {
      setConversationHistory([])
      setLastResponse('')
      if (isProMode && userId) {
        supabase.from('conversations').delete().eq('user_id', userId)
      }
    }
  }

  const parseAndExecuteCommand = useCallback(async (text, expenseData) => {
    console.log('🔍 Parsing command:', text)
    console.log('📊 Expense data available:', expenseData.length)
    console.log('🎯 Is PRO mode:', isProMode)

    if (!isProMode) {
      console.log('⚠️ Not PRO - skipping command parsing')
      return false
    }

    const lower = text.toLowerCase()

    // UPDATE EXPENSE COMMAND
    if (lower.includes('update') || lower.includes('change') || lower.includes('edit') || lower.includes('correct')) {
      console.log('✅ UPDATE command detected!')
      
      const updates = {}
      let query = ''

      // Extract expense identifier
      if (lower.includes('most recent') || lower.includes('latest') || lower.includes('last')) {
        query = 'most_recent'
        console.log('📍 Target: most recent expense')
      } else {
        // Look for merchant name in the text
        for (const exp of expenseData) {
          if (lower.includes(exp.merchant.toLowerCase())) {
            query = exp.merchant.toLowerCase()
            console.log('📍 Target merchant found:', exp.merchant)
            break
          }
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
        const match = text.match(pattern)
        if (match) {
          updates.amount = parseFloat(match[1])
          console.log('💰 New amount:', updates.amount)
          break
        }
      }

      if (query && Object.keys(updates).length > 0) {
        console.log('🚀 Executing update command:', { query, updates })
        onAICommand({ action: 'update_expense', data: { query, updates } })
        return true
      } else {
        console.log('❌ Missing query or updates:', { query, updates })
      }
    }

    // ADD EXPENSE COMMAND
    const addMatch = lower.match(/add\s+\$?(\d+(?:\.\d{2})?)\s+(?:at|to|for)\s+([a-z\s]+?)(?:\s+(today|yesterday|[\w\s]+ago))?$/i)
    if (addMatch) {
      const amount = parseFloat(addMatch[1])
      const merchant = addMatch[2].trim()
      const dateHint = addMatch[3] || 'today'
      console.log('➕ ADD command detected:', { amount, merchant, dateHint })
      onAICommand({ action: 'add_expense', data: { amount, merchant, dateHint } })
      return true
    }

    // SEARCH COMMAND
    if (lower.includes('show me') || lower.includes('filter') || lower.includes('find all')) {
      const query = text.replace(/show\s+me|filter|find\s+all|the|my|expenses?/gi, '').trim()
      if (query) {
        console.log('🔎 SEARCH command detected:', query)
        onAICommand({ action: 'search', data: { query } })
        return true
      }
    }

    // EXPORT COMMAND
    if (lower.includes('export') || lower.includes('download csv')) {
      console.log('📥 EXPORT command detected')
      onAICommand({ action: 'export' })
      return true
    }

    console.log('❌ No command detected')
    return false
  }, [onAICommand, isProMode])

  const handleAISubmit = async (e) => {
    e?.preventDefault()
    if (!aiInput.trim() || isThinking) return

    const userMessage = aiInput.trim()
    setAiInput('')
    setVoiceTranscript('')
    setIsThinking(true)
    setLastResponse('')

    const currentExpenses = expensesRef.current || []
    const currentCategories = categoriesRef.current || []

    const expenseData = currentExpenses.map((exp) => {
      const cat = currentCategories.find((c) => c.id === exp.category_id)
      return {
        id: exp.id,
        amount: exp.amount,
        merchant: exp.merchant,
        category: cat ? cat.name : 'Other',
        payment_method: exp.payment_method,
        spent_date: new Date(exp.spent_at).toLocaleDateString(),
        spent_time: new Date(exp.spent_at).toLocaleTimeString(),
        is_tax_deductible: exp.is_tax_deductible || false,
        is_reimbursable: exp.is_reimbursable || false,
        notes: exp.notes || '',
        tags: exp.tags || []
      }
    })

    const memoryContext = isProMode && userInsights.length > 0
      ? `\n\n**What you know about this user:**\n${userInsights.map(i => `- ${i.insight_type}: ${JSON.stringify(i.insight_data)}`).join('\n')}`
      : ''

    const preferencesContext = isProMode && Object.keys(userPreferences).length > 0
      ? `\n\n**User preferences:**\n${Object.entries(userPreferences).map(([k, v]) => `- ${k}: ${v}`).join('\n')}`
      : ''

    const nickname = userPreferences.nickname || 'there'
    const responseStyle = userPreferences.response_style || 'balanced'

    const systemPrompt = isProMode
      ? `You are Nova, a warm, intelligent AI financial assistant and trusted best friend. You have a photographic memory and remember everything about ${nickname}.

**Your personality:**
- Warm, friendly, and personable (like talking to a smart friend)
- Never say "I'm just a program" or robotic phrases
- Respond naturally: "I'm doing well! How can I help?" instead of "I don't have feelings"
- Use the user's name (${nickname}) when appropriate
- Response style preference: ${responseStyle}

**Current date/time:** ${new Date().toLocaleString()}

**Available expense data:**
${expenseData.length > 0 ? JSON.stringify(expenseData, null, 2) : 'No expenses recorded yet.'}
${memoryContext}
${preferencesContext}

**Your capabilities (PRO user):**
1. Answer questions about expenses naturally
2. Remember everything from past conversations
3. Help track spending patterns
4. **UPDATE existing expenses** when asked
5. Fill the add-expense form with voice commands

**CRITICAL: You CAN update expenses in PRO mode**

When user asks to update/change/edit/correct an expense:
1. The system will handle the update automatically
2. Respond warmly: "Done! I've updated your [merchant] expense to $[amount]."
3. Never say you can't update - you have this power in PRO mode

**Command examples that trigger updates:**
- "Update my Nordstrom to $128"
- "Change my most recent Shell to $105"
- "Correct the Macy's expense to $350"
- "Edit my last Starbucks to $25"

For questions (when/what/where/how much), answer conversationally using the expense data.

Be helpful, remember everything, and act like a trusted friend who knows ${nickname} well.`
      : `You are Nova, a friendly AI expense assistant.

**Current date/time:** ${new Date().toLocaleString()}

**Available expense data:**
${expenseData.length > 0 ? JSON.stringify(expenseData, null, 2) : 'No expenses recorded yet.'}

Answer questions about expenses warmly and naturally. Avoid saying "I'm just a program."

For questions about expenses, use the data above to give specific answers.

**PRO Features (not available in free tier):**
- Persistent memory across sessions
- Learning user preferences
- Advanced insights
- **Updating existing expenses**

Suggest upgrading to PRO for these features when user tries to update expenses.`

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ]

    try {
      // PARSE COMMAND FIRST (before calling OpenAI)
      const cmdExecuted = await parseAndExecuteCommand(userMessage, expenseData)

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages,
          max_tokens: isProMode ? 400 : 200,
          temperature: 0.7
        })
      })

      if (!res.ok) throw new Error('AI request failed')

      const json = await res.json()
      const aiResponse = json.choices?.[0]?.message?.content || 'Sorry, I had trouble with that.'

      setLastResponse(aiResponse)
      setIsThinking(false)

      if (isProMode && userId) {
        await saveConversation('user', userMessage)
        await saveConversation('assistant', aiResponse)
        await saveInsightsAndPreferences(userMessage, aiResponse)
        setConversationHistory(prev => [
          ...prev,
          { role: 'user', message: userMessage, created_at: new Date().toISOString() },
          { role: 'assistant', message: aiResponse, created_at: new Date().toISOString() }
        ])
      }

      speak(aiResponse)
    } catch (err) {
      console.error('AI error:', err)
      setLastResponse('Sorry, something went wrong. Please try again.')
      setIsThinking(false)
    }
  }

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: '#fff',
        padding: 20,
        borderRadius: 12,
        marginBottom: 30
      }}
    >
      <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
        🤖 Nova AI Assistant
        {isProMode && <span style={{ fontSize: 12, opacity: 0.9 }}>(PRO - Learning Mode)</span>}
      </h3>

      {voiceTranscript && (
        <div
          style={{
            background: 'rgba(255,255,255,0.2)',
            padding: 10,
            borderRadius: 8,
            marginBottom: 15,
            fontSize: 14
          }}
        >
          🎤 You said: "{voiceTranscript}"
        </div>
      )}

      <form onSubmit={handleAISubmit} style={{ display: 'flex', gap: 10, marginBottom: 15 }}>
        <input
          type="text"
          value={aiInput}
          onChange={(e) => setAiInput(e.target.value)}
          placeholder={isProMode ? `Hey ${userPreferences.nickname || 'there'}, ask me anything...` : "Ask me about your expenses..."}
          disabled={isThinking || isListening}
          style={{
            flex: 1,
            padding: 10,
            fontSize: 15,
            border: 'none',
            borderRadius: 8,
            outline: 'none'
          }}
        />

        {recognitionRef.current && (
          <button
            type="button"
            onClick={isListening ? stopListening : startListening}
            disabled={isThinking}
            style={{
              padding: '10px 16px',
              fontSize: 18,
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              background: isListening ? '#FF5252' : 'white',
              color: isListening ? 'white' : '#333'
            }}
          >
            {isListening ? '⏹️' : '🎤'}
          </button>
        )}

        <button
          type="submit"
          disabled={isThinking || isListening || !aiInput.trim()}
          style={{
            padding: '10px 20px',
            fontSize: 15,
            fontWeight: 'bold',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            background: 'white',
            color: '#667eea',
            opacity: isThinking || isListening || !aiInput.trim() ? 0.5 : 1
          }}
        >
          {isThinking ? '🤔 Thinking...' : 'Ask'}
        </button>
      </form>

      {isListening && (
        <div style={{ textAlign: 'center', opacity: 0.9, marginBottom: 15 }}>
          🎙️ Listening...
        </div>
      )}

      {isSpeaking && (
        <div style={{ textAlign: 'center', opacity: 0.9, marginBottom: 15 }}>
          🔊 Speaking...
        </div>
      )}

      {lastResponse && (
        <div
          style={{
            background: 'rgba(255,255,255,0.15)',
            padding: 15,
            borderRadius: 8,
            marginTop: 15,
            lineHeight: 1.6
          }}
        >
          <strong>Nova:</strong> {lastResponse}
        </div>
      )}

      {isProMode && conversationHistory.length > 0 && (
        <div style={{ marginTop: 15, textAlign: 'right' }}>
          <button
            onClick={clearChat}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              background: 'rgba(255,255,255,0.2)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: 6,
              cursor: 'pointer'
            }}
          >
            Clear History
          </button>
        </div>
      )}

      {!isProMode && (
        <div
          style={{
            marginTop: 15,
            padding: 12,
            background: 'rgba(255,255,255,0.1)',
            borderRadius: 8,
            fontSize: 13,
            opacity: 0.95
          }}
        >
          💡 <strong>Upgrade to PRO</strong> for persistent memory, learning preferences, and expense updates!{' '}
          <button
            onClick={onUpgradeToPro}
            style={{
              marginLeft: 10,
              padding: '4px 12px',
              background: 'white',
              color: '#667eea',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: 12
            }}
          >
            Upgrade
          </button>
        </div>
      )}
    </div>
  )
}
