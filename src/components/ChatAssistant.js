import { useState, useEffect, useRef } from 'react'
import MemoryManager from '../lib/MemoryManager'
import NovaAgent from '../lib/NovaAgent'

export default function ChatAssistant({
  expenses,
  categories,
  isProMode,
  onUpgradeToPro,
  onAICommand,
  userId,
  notifications = [],
  onDismissNotification
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
  const profileLoadedRef = useRef(false)

  useEffect(() => {
    expensesRef.current = expenses
  }, [expenses])

  useEffect(() => {
    categoriesRef.current = categories
  }, [categories])

  // Initialize Memory and Agent
  useEffect(() => {
    if (!userId) {
      console.warn('⏳ Waiting for userId...')
      return
    }

    if (!memoryRef.current) {
      console.log('🚀 Initializing Nova for user:', userId)
      const memory = new MemoryManager(userId)
      memoryRef.current = memory

      const tools = {
        update_expense: (data) => onAICommand({ action: 'update_expense', data }),
        add_expense: (data) => onAICommand({ action: 'add_expense', data }),
        search: (data) => onAICommand({ action: 'search', data }),
        export: () => onAICommand({ action: 'export' })
      }

      const agent = new NovaAgent(memory, tools, isProMode)
      agentRef.current = agent

      setIsInitialized(true)
      console.log('✅ Nova initialized')
    }
  }, [userId, onAICommand, isProMode])

  // Load profile when PRO mode activates
  useEffect(() => {
    if (isProMode && memoryRef.current && !profileLoadedRef.current) {
      profileLoadedRef.current = true
      
      const loadProfile = async () => {
        console.log('📥 Loading profile for PRO user...')
        await memoryRef.current.loadProfile()
        
        // Update agent with PRO mode
        if (agentRef.current) {
          agentRef.current.isProMode = true
        }
      }
      
      loadProfile()
    }
  }, [isProMode])

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
        console.log('🎤 Voice transcript:', transcript)
        setVoiceTranscript(transcript)
        setAiInput(transcript)
        setIsListening(false)
        
        setTimeout(() => {
          setShouldAutoSubmit(true)
        }, 500)
      }

      recognition.onerror = (event) => {
        console.error('🎤 Voice error:', event.error)
        setIsListening(false)
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognitionRef.current = recognition
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
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
      console.error('🔊 TTS error:', err)
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
    
    if (!isInitialized) {
      console.warn('⏳ Nova not ready yet')
      return
    }

    if (!aiInput.trim() || isThinking) return

    const userMessage = aiInput.trim()
    setAiInput('')
    setVoiceTranscript('')
    setIsThinking(true)

    const memory = memoryRef.current
    const agent = agentRef.current

    if (!memory || !agent) {
      setLastResponse('Nova is still waking up... try again in a moment.')
      setIsThinking(false)
      return
    }

    console.log('💬 User message:', userMessage)

    // Add user message to session memory
    memory.addMessage('user', userMessage)

    // Build expense data
    const expenseData = {
      expenses: expensesRef.current || [],
      categories: categoriesRef.current || []
    }

    console.log('📊 Expense data:', {
      expenses: expenseData.expenses.length,
      categories: expenseData.categories.length
    })

    try {
      // Check for commands (PRO mode)
      if (isProMode) {
        const command = await agent.detectAndExecute(userMessage, expenseData)
        
        if (command) {
          console.log('🚀 Executing command:', command)
          
          if (onAICommand) {
            await onAICommand(command)
          }
        }
      }

      // Build system prompt (now includes emotional intelligence)
      const systemPrompt = agent.buildSystemPrompt(expenseData)

      // Build messages with conversation history
      const messages = agent.buildMessages(systemPrompt, userMessage)

      console.log('💬 Sending to OpenAI with context:', messages.length, 'messages')

      // Call OpenAI
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

      console.log('🤖 Nova response:', aiResponse)

      // Add AI response to session memory
      memory.addMessage('assistant', aiResponse)
      setLastResponse(aiResponse)

      // CRITICAL: Save to database (PRO only)
      if (isProMode) {
        console.log('💾 Saving conversation to database...')
        
        await memory.saveConversation('user', userMessage)
        await memory.saveConversation('assistant', aiResponse)
        
        console.log('🧠 Learning from conversation...')
        await memory.learnFromConversation(userMessage, aiResponse)
        
        console.log('✅ Memory saved!')
      }

      setIsThinking(false)
      speak(aiResponse)

    } catch (err) {
      console.error('💥 Nova error:', err)
      setLastResponse('Sorry, something went wrong. Please try again.')
      setIsThinking(false)
    }
  }

  const nickname = memoryRef.current?.getNickname() || 'there'

  // Get notification icon
  const getNotificationIcon = (type) => {
    switch (type) {
      case 'greeting':
        return '👋'
      case 'inactivity':
        return '⏰'
      case 'budget_alert':
        return '⚠️'
      case 'budget_win':
        return '🎉'
      case 'pattern_detected':
        return '🔍'
      case 'subscription_detected':
        return '💳'
      case 'subscription_renewal':
        return '⏰'
      case 'budget_forecast':
        return '📊'
      case 'budget_forecast_alert':
        return '⚠️'
      case 'unused_subscription':
        return '💡'
      default:
        return '💡'
    }
  }

  // Format notification time
  const formatNotificationTime = (timestamp) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays}d ago`
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          🤖 Nova - Your AI Best Friend
          {isProMode && <span style={{ fontSize: 12, opacity: 0.9 }}>✨ Learning Mode • 💜 Emotionally Intelligent</span>}
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

      {/* Proactive Notifications Section */}
      {isProMode && notifications.length > 0 && (
        <div style={{ marginBottom: 15, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {notifications.map((notif) => (
            <div
              key={notif.id}
              style={{
                background: 'rgba(255,255,255,0.2)',
                backdropFilter: 'blur(10px)',
                padding: 12,
                borderRadius: 8,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                border: '1px solid rgba(255,255,255,0.3)',
                animation: 'slideIn 0.3s ease-out'
              }}
            >
              <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ fontSize: 24, lineHeight: 1 }}>
                  {getNotificationIcon(notif.notification_type)}
                </span>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
                    {notif.message}
                  </p>
                  <p style={{ margin: '4px 0 0 0', fontSize: 11, opacity: 0.7 }}>
                    {formatNotificationTime(notif.created_at)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => onDismissNotification(notif.id)}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 12,
                  marginLeft: 10,
                  flexShrink: 0
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

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
              💡 <strong>Upgrade to PRO</strong> to unlock Nova's full intelligence - emotional understanding, perfect memory, and true AI companionship!{' '}
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
