import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import MemoryManager from '../lib/MemoryManager'
import NovaAgent from '../lib/NovaAgent'

// Global flag to prevent multiple greetings across all instances
let hasGreetedGlobally = false

function ChatAssistant({ expenses, categories, isProMode, onUpgradeToPro, onAICommand, userId, notifications = [], onDismissNotification }) {
  const [aiInput, setAiInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [lastResponse, setLastResponse] = useState('')
  const [voiceTranscript, setVoiceTranscript] = useState('')
  const [shouldAutoSubmit, setShouldAutoSubmit] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [voiceGreetingEnabled, setVoiceGreetingEnabled] = useState(true)

  const recognitionRef = useRef(null)
  const audioRef = useRef(null)
  const memoryRef = useRef(null)
  const agentRef = useRef(null)
  const expensesRef = useRef(expenses)
  const categoriesRef = useRef(categories)
  const profileLoadedRef = useRef(false)
  const initLockRef = useRef(false)

  useEffect(() => {
    expensesRef.current = expenses
    categoriesRef.current = categories
  }, [expenses, categories])

  useEffect(() => {
    if (!userId || initLockRef.current) return
    initLockRef.current = true

    const initNova = async () => {
      memoryRef.current = new MemoryManager(userId)
      await memoryRef.current.loadProfile()

      const tools = {
        add_expense: async (params) => {
          const result = await onAICommand({ action: 'add_expense', data: params })
          return result
        },
        search: async (params) => {
          const result = await onAICommand({ action: 'search', data: { term: params.query } })
          return result
        },
        export: async () => {
          const result = await onAICommand({ action: 'export', data: {} })
          return result
        },
        update_expense: async (params) => {
          const result = await onAICommand({ action: 'update_expense', data: params })
          return result
        }
      }

      agentRef.current = new NovaAgent(memoryRef.current, tools, true)

      const { data, error } = await supabase
        .from('user_preferences')
        .select('preference_value')
        .eq('user_id', userId)
        .eq('preference_type', 'voice_greeting')
        .single()

      if (!error && data) {
        setVoiceGreetingEnabled(data.preference_value === 'true')
      }

      setIsInitialized(true)
      console.log('✅ Nova initialized')
      
      // Greet ONCE per page session
      if (isProMode && !hasGreetedGlobally && (error || !data || data.preference_value === 'true')) {
        hasGreetedGlobally = true
        setTimeout(() => {
          const displayName = memoryRef.current?.preferences?.display_name || memoryRef.current?.getNickname() || 'friend'
          const title = memoryRef.current?.preferences?.title
         const greeting = title ? `Hello ${displayName}. ${title}.` : ...
 displayName !== 'friend' ? `Hello ${displayName}!` : 'Hello!'
          console.log('👋 Greeting:', greeting)
          speak(greeting)
        }, 1000)
      }
    }

    initNova()
  }, [userId, onAICommand, isProMode])

  useEffect(() => {
    if (isProMode && !profileLoadedRef.current && agentRef.current) {
      agentRef.current.pushContext('isProMode', true)
      profileLoadedRef.current = true
    }
  }, [isProMode])

  useEffect(() => {
    if (shouldAutoSubmit && aiInput.trim()) {
      setShouldAutoSubmit(false)
      handleAISubmit()
    }
  }, [shouldAutoSubmit, aiInput])

  useEffect(() => {
    if ('webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.webkitSpeechRecognition
      recognitionRef.current = new SpeechRecognition()
      recognitionRef.current.continuous = false
      recognitionRef.current.interimResults = false
      recognitionRef.current.lang = 'en-US'

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript
        setVoiceTranscript(transcript)
        setAiInput(transcript)
        setShouldAutoSubmit(true)
      }

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error)
        setIsListening(false)
      }

      recognitionRef.current.onend = () => {
        setIsListening(false)
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
      if (audioRef.current) {
        audioRef.current.pause()
      }
    }
  }, [])

  const startListening = () => {
    if (!isProMode) {
      onUpgradeToPro()
      return
    }

    if (recognitionRef.current && !isListening) {
      recognitionRef.current.start()
      setIsListening(true)
      setVoiceTranscript('')
    }
  }

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    }
  }

  const speak = async (text) => {
    if (!voiceGreetingEnabled) return

    try {
      setIsSpeaking(true)

      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'tts-1',
          voice: 'nova',
          input: text,
          speed: 0.95
        })
      })

      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)

      audioRef.current = new Audio(audioUrl)
      audioRef.current.onended = () => {
        setIsSpeaking(false)
        URL.revokeObjectURL(audioUrl)
      }
      audioRef.current.onerror = () => {
        setIsSpeaking(false)
        URL.revokeObjectURL(audioUrl)
      }

      await audioRef.current.play()
    } catch (err) {
      console.error('TTS error:', err)
      setIsSpeaking(false)
    }
  }

  const clearChat = () => {
    if (window.confirm('Clear conversation history?')) {
      if (memoryRef.current) {
        memoryRef.current.clearSession()
      }
      setLastResponse('')
    }
  }

  const toggleVoiceGreeting = async () => {
    if (!isProMode) {
      onUpgradeToPro()
      return
    }

    const newValue = !voiceGreetingEnabled
    setVoiceGreetingEnabled(newValue)

    try {
      await supabase.from('user_preferences').upsert({
        user_id: userId,
        preference_type: 'voice_greeting',
        preference_value: newValue.toString(),
        set_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,preference_type'
      })

      const confirmMessage = newValue ? 'Voice greeting has been turned on.' : 'Voice greeting has been turned off.'
      setLastResponse(confirmMessage)
      if (newValue) {
        speak(confirmMessage)
      }
    } catch (err) {
      console.error('Toggle voice greeting error:', err)
    }
  }

  const handleAISubmit = async () => {
    if (!isInitialized) {
      setLastResponse('⚠️ Nova is initializing... please wait.')
      return
    }

    if (!aiInput.trim()) return

    const userMessage = aiInput
    setAiInput('')
    setIsThinking(true)

    try {
      memoryRef.current.addMessage('user', userMessage)

      let response = ''

      if (isProMode && agentRef.current) {
        const agentResponse = await agentRef.current.detectAndExecute(userMessage, {
          expenses: expensesRef.current,
          categories: categoriesRef.current
        })

        // If agent handled a command, show success message
        if (agentResponse && agentResponse.handled) {
          response = agentResponse.response || agentResponse.message || 'Task completed successfully!'
        } else {
          // Agent couldn't handle it - fall back to OpenAI chat
          const systemPrompt = agentRef.current.buildSystemPrompt({
            expenses: expensesRef.current,
            categories: categoriesRef.current
          })

          const conversationHistory = memoryRef.current.getConversationHistory()

          const apiMessages = [
            { role: 'system', content: systemPrompt },
            ...conversationHistory.map(msg => ({ role: msg.role, content: msg.content })),
            { role: 'user', content: userMessage }
          ]

          const apiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`
            },
            body: JSON.stringify({
              model: 'gpt-4o',
              messages: apiMessages,
              max_tokens: 500
            })
          })

          const data = await apiResponse.json()
          response = data.choices[0].message.content
        }
      } else {
        const systemPrompt = `You are Nova, a friendly AI assistant for expense tracking. Be helpful and concise.${memoryRef.current.buildMemoryContext()}`

        const conversationHistory = memoryRef.current.getConversationHistory()

        const apiMessages = [
          { role: 'system', content: systemPrompt },
          ...conversationHistory.map(msg => ({ role: msg.role, content: msg.content })),
          { role: 'user', content: userMessage }
        ]

        const apiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: apiMessages,
            max_tokens: 500
          })
        })

        const data = await apiResponse.json()
        response = data.choices[0].message.content
      }

      setLastResponse(response)
      memoryRef.current.addMessage('assistant', response)

      if (isProMode) {
        await memoryRef.current.saveConversation('user', userMessage)
        await memoryRef.current.saveConversation('assistant', response)
        await memoryRef.current.learnFromConversation(userMessage, response)
      }

      speak(response)
    } catch (err) {
      console.error('AI error:', err)
      setLastResponse('❌ Sorry, something went wrong.')
    } finally {
      setIsThinking(false)
    }
  }

  const nickname = memoryRef.current ? memoryRef.current.getNickname() : 'friend'

  const getNotificationIcon = (type) => {
    const icons = {
      insight: '💡',
      warning: '⚠️',
      achievement: '🏆',
      tip: '💰'
    }
    return icons[type] || '🔔'
  }

  const formatNotificationTime = (timestamp) => {
    const diff = Date.now() - new Date(timestamp).getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      borderRadius: '16px',
      padding: '20px',
      marginBottom: '20px',
      color: 'white'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h3 style={{ margin: 0 }}>🤖 Nova AI Assistant</h3>
          {isProMode && (
            <span style={{
              background: 'rgba(255,255,255,0.3)',
              padding: '4px 12px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: 'bold'
            }}>
              PRO
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {isProMode && (
            <button
              onClick={toggleVoiceGreeting}
              style={{
                padding: '8px 12px',
                background: voiceGreetingEnabled ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
                border: '2px solid rgba(255,255,255,0.5)',
                borderRadius: '8px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 'bold'
              }}
            >
              🔊 Voice Greeting {voiceGreetingEnabled ? 'ON' : 'OFF'}
            </button>
          )}
          {memoryRef.current && memoryRef.current.sessionMessages.length > 0 && (
            <button
              onClick={clearChat}
              style={{
                padding: '8px 12px',
                background: 'rgba(239, 68, 68, 0.3)',
                border: '2px solid rgba(255,255,255,0.5)',
                borderRadius: '8px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              🗑️ Clear Chat
            </button>
          )}
        </div>
      </div>

      {isProMode && notifications && notifications.length > 0 && (
        <div style={{ marginBottom: '15px' }}>
          {notifications.map((notif, idx) => (
            <div
              key={idx}
              style={{
                background: 'rgba(255,255,255,0.2)',
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>{getNotificationIcon(notif.type)}</span>
                <div>
                  <p style={{ margin: 0, fontWeight: 'bold' }}>{notif.message}</p>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', opacity: 0.8 }}>
                    {formatNotificationTime(notif.timestamp)}
                  </p>
                </div>
              </div>
              {onDismissNotification && (
                <button
                  onClick={() => onDismissNotification(idx)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '18px'
                  }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
        <input
          type="text"
          value={aiInput}
          onChange={(e) => setAiInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleAISubmit()}
          placeholder={isProMode ? `Ask Nova anything, ${nickname}...` : "Ask Nova about your expenses..."}
          disabled={isThinking || isListening}
          style={{
            flex: 1,
            padding: '12px',
            border: '2px solid rgba(255,255,255,0.3)',
            borderRadius: '8px',
            background: 'rgba(255,255,255,0.2)',
            color: 'white',
            fontSize: '14px'
          }}
        />
        {isProMode && (
          <button
            onClick={isListening ? stopListening : startListening}
            disabled={isThinking}
            style={{
              padding: '12px 20px',
              background: isListening ? '#ef4444' : 'rgba(255,255,255,0.3)',
              border: '2px solid rgba(255,255,255,0.5)',
              borderRadius: '8px',
              color: 'white',
              cursor: isThinking ? 'not-allowed' : 'pointer',
              fontWeight: 'bold'
            }}
          >
            {isListening ? '🔴 Stop' : '🎤 Speak'}
          </button>
        )}
        <button
          onClick={handleAISubmit}
          disabled={isThinking || !aiInput.trim()}
          style={{
            padding: '12px 20px',
            background: isThinking ? '#6b7280' : 'rgba(255,255,255,0.3)',
            border: '2px solid rgba(255,255,255,0.5)',
            borderRadius: '8px',
            color: 'white',
            cursor: isThinking || !aiInput.trim() ? 'not-allowed' : 'pointer',
            fontWeight: 'bold'
          }}
        >
          {isThinking ? '⏳ Thinking...' : '✨ Ask'}
        </button>
      </div>

      {lastResponse && (
        <div style={{
          background: 'rgba(255,255,255,0.2)',
          padding: '15px',
          borderRadius: '8px',
          marginTop: '15px'
        }}>
          <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{lastResponse}</p>
          {isSpeaking && (
            <p style={{ margin: '10px 0 0 0', fontSize: '12px', opacity: 0.8 }}>🔊 Speaking...</p>
          )}
        </div>
      )}

      {!isProMode && (
        <div style={{
          marginTop: '15px',
          padding: '12px',
          background: 'rgba(255,255,255,0.2)',
          borderRadius: '8px',
          fontSize: '13px',
          textAlign: 'center'
        }}>
          💡 Upgrade to PRO for voice commands, memory, and advanced AI features!
        </div>
      )}
    </div>
  )
}

export default ChatAssistant
