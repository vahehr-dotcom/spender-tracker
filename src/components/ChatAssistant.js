import { useState, useEffect, useRef } from 'react'
import MemoryManager from '../lib/MemoryManager'
import NovaAgent from '../lib/NovaAgent'

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
  const [isInitialized, setIsInitialized] = useState(false)

  const recognitionRef = useRef(null)
  const audioRef = useRef(null)
  const memoryRef = useRef(null)
  const agentRef = useRef(null)
  const expensesRef = useRef(expenses)
  const categoriesRef = useRef(categories)

  // Keep expense/category refs updated
  useEffect(() => {
    expensesRef.current = expenses
  }, [expenses])

  useEffect(() => {
    categoriesRef.current = categories
  }, [categories])

  // Initialize Memory and Agent
  useEffect(() => {
    if (userId && !memoryRef.current) {
      const memory = new MemoryManager(userId)
      memoryRef.current = memory

      // Load user profile
      if (isProMode) {
        memory.loadProfile().then(() => {
          console.log('✅ Nova initialized with memory')
          setIsInitialized(true)
        })
      } else {
        setIsInitialized(true)
      }

      // Initialize agent with tools
      const tools = {
        update_expense: (data) => onAICommand({ action: 'update_expense', data }),
        add_expense: (data) => onAICommand({ action: 'add_expense', data }),
        search: (data) => onAICommand({ action: 'search', data }),
        export: () => onAICommand({ action: 'export' })
      }

      const agent = new NovaAgent(memory, tools, isProMode)
      agentRef.current = agent
    }
  }, [userId, isProMode, onAICommand])

  // Voice auto-submit trigger
  useEffect(() => {
    if (shouldAutoSubmit && aiInput.trim()) {
      setShouldAutoSubmit(false)
      handleAISubmit({ preventDefault: () => {} })
    }
  }, [shouldAutoSubmit, aiInput])

  // Setup voice recognition
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
    if (window.confirm('Clear conversation? Nova will still remember you, just reset this chat.')) {
      if (memoryRef.current) {
        memoryRef.current.clearSession()
      }
      setLastResponse('')
    }
  }

  const handleAISubmit = async (e) => {
    e?.preventDefault()
    if (!aiInput.trim() || isThinking || !isInitialized) return

    const userMessage = aiInput.trim()
    setAiInput('')
    setVoiceTranscript('')
    setIsThinking(true)
    setLastResponse('')

    const memory = memoryRef.current
    const agent = agentRef.current

    if (!memory || !agent) {
      setLastResponse('Nova is still waking up... try again in a moment.')
      setIsThinking(false)
      return
    }

    // Add user message to memory
    memory.addMessage('user', userMessage)

    // Build expense data
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

    try {
      // 1. Let agent detect and execute commands
      await agent.detectAndExecute(userMessage, expenseData)

      // 2. Build system prompt with personality + memory
      const systemPrompt = agent.buildSystemPrompt(expenseData)

      // 3. Build messages with conversation history
      const messages = agent.buildMessages(systemPrompt, userMessage)

      // 4. Call OpenAI
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

      // 5. Add AI response to memory
      memory.addMessage('assistant', aiResponse)

      // 6. Learn from conversation (PRO only)
      if (isProMode) {
        memory.saveConversation('user', userMessage)
        memory.saveConversation('assistant', aiResponse)
        memory.learnFromConversation(userMessage, aiResponse)
      }

      setLastResponse(aiResponse)
      setIsThinking(false)

      // 7. Speak response
      speak(aiResponse)

    } catch (err) {
      console.error('Nova error:', err)
      setLastResponse('Sorry, something went wrong. Please try again.')
      setIsThinking(false)
    }
  }

  const nickname = memoryRef.current?.getNickname() || 'there'

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          🤖 Nova - Your AI Best Friend
          {isProMode && <span style={{ fontSize: 12, opacity: 0.9 }}>✨ Learning Mode</span>}
        </h3>
        
        {memoryRef.current && memoryRef.current.sessionMessages.length > 0 && (
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
            Clear Chat
          </button>
        )}
      </div>

      {!isInitialized && (
        <div style={{ textAlign: 'center', opacity: 0.8, padding: 20 }}>
          ⏳ Nova is waking up...
        </div>
      )}

      {isInitialized && (
        <>
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
              placeholder={isProMode ? `Hey ${nickname}, what's on your mind?` : "Ask me about your expenses..."}
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
              💡 <strong>Upgrade to PRO</strong> to unlock Nova's full intelligence - she'll remember you forever, learn your habits, and become your true AI best friend!{' '}
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
                Upgrade Now
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
