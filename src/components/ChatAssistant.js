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
  const [shouldAutoSubmit, setShouldAutoSubmit] = useState(false)

  const [sessionMessages, setSessionMessages] = useState([])  // NEW: In-memory conversation
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

  useEffect(() => {
    if (shouldAutoSubmit && aiInput.trim()) {
      setShouldAutoSubmit(false)
      handleAISubmit({ preventDefault: () => {} })
    }
  }, [shouldAutoSubmit, aiInput])

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
        
        setTimeout(() => {
          setShouldAutoSubmit(true)
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
      setSessionMessages([])
      setLastResponse('')
      if (isProMode && userId) {
        supabase.from('conversations').delete().eq('user_id', userId)
      }
    }
  }

  const parseAndExecuteCommand = useCallback(async (text, expenseData) => {
    console.log('🔍 Parsing command:', text)

    if (!isProMode) {
      return false
    }

    const lower = text.toLowerCase()

    // UPDATE EXPENSE COMMAND
    if (lower.includes('update') || lower.includes('change') || lower.includes('edit') || lower.includes('correct')) {
      console.log('✅ UPDATE command detected!')
      
      const updates = {}
      let query = ''

      if (lower.includes('most recent') || lower.includes('latest') || lower.includes('last')) {
        query = 'most_recent'
        console.log('📍 Target: most recent expense')
      } else {
        for (const exp of expenseData) {
          if (lower.includes(exp.merchant.toLowerCase())) {
            query = exp.merchant.toLowerCase()
            console.log('📍 Target merchant found:', exp.merchant)
            break
          }
        }
      }

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
      }
    }

    const addMatch = lower.match(/add\s+\$?(\d+(?:\.\d{2})?)\s+(?:at|to|for)\s+([a-z\s]+?)(?:\s+(today|yesterday|[\w\s]+ago))?$/i)
    if (addMatch) {
      const amount = parseFloat(addMatch[1])
      const merchant = addMatch[2].trim()
      const dateHint = addMatch[3] || 'today'
      onAICommand({ action: 'add_expense', data: { amount, merchant, dateHint } })
      return true
    }

    if (lower.includes('show me') || lower.includes('filter') || lower.includes('find all')) {
      const query = text.replace(/show\s+me|filter|find\s+all|the|my|expenses?/gi, '').trim()
      if (query) {
        onAICommand({ action: 'search', data: { query } })
        return true
      }
    }

    if (lower.includes('export') || lower.includes('download csv')) {
      onAICommand({ action: 'export' })
      return true
    }

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

    const systemPrompt = `You are Nova, a warm, intelligent AI financial assistant and trusted best friend. You have a photographic memory and remember everything about ${nickname}.

**Your personality:**
- Warm, friendly, and personable
- Never say "I'm just a program"
- Respond naturally: "I'm doing well! How can I help?"
- Use the user's name (${nickname}) when appropriate
- Response style: ${responseStyle}

**CRITICAL: Remember the ENTIRE conversation thread. If user mentions "Nordstrom from Jan 20" and then says "update to $125", you know they mean the Nordstrom expense.**

**Current date/time:** ${new Date().toLocaleString()}

**Available expense data:**
${expenseData.length > 0 ? JSON.stringify(expenseData, null, 2) : 'No expenses recorded yet.'}
${memoryContext}
${preferencesContext}

**Your capabilities (PRO):**
1. Answer questions about expenses
2. Remember everything from THIS conversation
3. **UPDATE existing expenses** - you CAN do this
4. Connect the dots across multiple messages

**When user wants to update an expense:**
- If they mention merchant/date, remember it for next message
- If they then give amount, combine both pieces of info
- Respond: "Done! Updated [merchant] to $[amount]"

Be smart, remember context, connect dots.`

    // Build message history: system + last 10 messages + current
    const messages = [
      { role: 'system', content: systemPrompt },
      ...sessionMessages.slice(-10),  // Last 10 messages for context
      { role: 'user', content: userMessage }
    ]

    try {
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
          max_tokens: isProMode ? 500 : 200,
          temperature: 0.7
        })
      })

      if (!res.ok) throw new Error('AI request failed')

      const json = await res.json()
      const aiResponse = json.choices?.[0]?.message?.content || 'Sorry, I had trouble with that.'

      setLastResponse(aiResponse)
      setIsThinking(false)

      // Add to session messages (in-memory context)
      setSessionMessages(prev => [
        ...prev,
        { role: 'user', content: userMessage },
        { role: 'assistant', content: aiResponse }
      ])

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

      {isProMode && sessionMessages.length > 0 && (
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
            Clear Conversation
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
          💡 <strong>Upgrade to PRO</strong> for conversation memory and expense updates!{' '}
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
