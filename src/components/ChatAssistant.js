import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import MemoryManager from '../lib/MemoryManager'
import NovaAgent from '../lib/NovaAgent'

let greetedUserId = null

function ChatAssistant({ expenses, categories, isProMode, onUpgradeToPro, onAICommand, userId, userProfile, notifications = [], onDismissNotification, onReloadExpenses }) {
  const [aiInput, setAiInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [lastResponse, setLastResponse] = useState('')
  const [lastUserMessage, setLastUserMessage] = useState('')
  const [voiceTranscript, setVoiceTranscript] = useState('')
  const [shouldAutoSubmit, setShouldAutoSubmit] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [voiceGreetingEnabled, setVoiceGreetingEnabled] = useState(true)
  const [hasGreeted, setHasGreeted] = useState(false)

  const recognitionRef = useRef(null)
  const audioRef = useRef(null)
  const memoryRef = useRef(null)
  const agentRef = useRef(null)
  const expensesRef = useRef(expenses)
  const categoriesRef = useRef(categories)
  const initLockRef = useRef(false)
  const onAICommandRef = useRef(onAICommand)
  const onReloadExpensesRef = useRef(onReloadExpenses)

  useEffect(() => {
    onAICommandRef.current = onAICommand
  }, [onAICommand])

  useEffect(() => {
    onReloadExpensesRef.current = onReloadExpenses
  }, [onReloadExpenses])

  useEffect(() => {
    expensesRef.current = expenses
    categoriesRef.current = categories
  }, [expenses, categories])

  useEffect(() => {
    if (agentRef.current) {
      agentRef.current.isProMode = isProMode
    }
  }, [isProMode])

  useEffect(() => {
    if (!userId || initLockRef.current) return
    initLockRef.current = true

    const initNova = async () => {
      memoryRef.current = new MemoryManager(userId)
      await memoryRef.current.loadProfile()

      const tools = {
        reload_expenses: async () => {
          if (onReloadExpensesRef.current) {
            await onReloadExpensesRef.current()
          }
        },
        search: async (params) => {
          try {
            const result = await onAICommandRef.current({ action: 'search', data: { term: params.query } })
            return result
          } catch (error) {
            return { success: false, error: error.message }
          }
        },
        export: async () => {
          try {
            const result = await onAICommandRef.current({ action: 'export', data: {} })
            return result
          } catch (error) {
            return { success: false, error: error.message }
          }
        },
        update_expense: async (params) => {
          try {
            const result = await onAICommandRef.current({ action: 'update_expense', data: params })
            return result
          } catch (error) {
            return { success: false, error: error.message }
          }
        }
      }

      agentRef.current = new NovaAgent(memoryRef.current, tools, true)

      try {
        const { data, error } = await supabase
          .from('user_preferences')
          .select('preference_value')
          .eq('user_id', userId)
          .eq('preference_type', 'voice_greeting')
          .single()

        if (!error && data) {
          setVoiceGreetingEnabled(data.preference_value === 'true')
        }
      } catch (err) {
        console.log('Voice greeting preference not found, defaulting to enabled')
      }

      setIsInitialized(true)
      console.log('✅ Nova initialized')
    }

    initNova()
  }, [userId])

  useEffect(() => {
    if (!userId || !userProfile || !isInitialized || hasGreeted) return
    if (greetedUserId === userId) return
    if (!voiceGreetingEnabled) return

    greetedUserId = userId
    setHasGreeted(true)

    const displayName = userProfile.first_name || userProfile.nickname || null
    const title = userProfile.title || null

   let greeting
    if (displayName && title) {
      greeting = `Hey ${displayName}, ${title}! Good to see you.`
    } else if (displayName) {
      greeting = `Hey ${displayName}! Good to see you.`
    } else {
      greeting = `Hey there! Good to see you.`
    }

    console.log('👋 Greeting:', greeting)
    setTimeout(() => speak(greeting), 500)

  }, [userId, userProfile, isInitialized, hasGreeted, voiceGreetingEnabled])

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
    try {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      setIsSpeaking(true)

      const cleanText = text.replace(/[*#_~`>]/g, '').replace(/\n{2,}/g, '. ').replace(/\n/g, '. ').trim()

      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanText, voice: 'nova', speed: 0.95 })
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

  const stopSpeaking = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    setIsSpeaking(false)
  }

  const clearChat = () => {
    if (window.confirm('Clear conversation history?')) {
      if (memoryRef.current) {
        memoryRef.current.clearSession()
      }
      setLastResponse('')
      setLastUserMessage('')
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
      }, { onConflict: 'user_id,preference_type' })

      const confirmMessage = newValue ? 'Voice greeting has been turned on.' : 'Voice greeting has been turned off.'
      setLastResponse(confirmMessage)
      if (newValue) speak(confirmMessage)
    } catch (err) {
      console.error('Toggle voice greeting error:', err)
    }
  }

  const handleAISubmit = async (overrideMessage) => {
    if (!isInitialized) {
      setLastResponse('⚠️ Nova is initializing... please wait.')
      return
    }

    const userMessage = overrideMessage || aiInput.trim()
    if (!userMessage) return
    setAiInput('')
    setIsThinking(true)
    setLastUserMessage(userMessage)

    try {
      if (!overrideMessage) {
        memoryRef.current.addMessage('user', userMessage)
      }

      let response = ''

      const expenseData = { expenses: expensesRef.current, categories: categoriesRef.current }
      
      if (agentRef.current) {
        agentRef.current.isProMode = isProMode
      }

      if (isProMode && agentRef.current) {
        const agentResult = await agentRef.current.detectAndExecute(userMessage, expenseData)

        if (agentResult.handled) {
          response = agentResult.response
        } else {
          const systemPrompt = await agentRef.current.buildSystemPrompt(expenseData)
          const messages = agentRef.current.buildMessages(systemPrompt, userMessage)
          const apiResponse = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages })
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
        const apiResponse = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: apiMessages })
        })
        const data = await apiResponse.json()
        response = data.choices[0].message.content
      }

      setLastResponse(response)

      if (!overrideMessage) {
        memoryRef.current.addMessage('assistant', response)
      }

      if (isProMode) {
        speak(response)
      }

      if (isProMode) {
        await memoryRef.current.saveConversation('user', userMessage)
        await memoryRef.current.saveConversation('assistant', response)
        await memoryRef.current.learnFromConversation(userMessage, response)
      }

    } catch (err) {
      console.error('AI error:', err)
      setLastResponse('❌ Sorry, something went wrong.')
    } finally {
      setIsThinking(false)
    }
  }

  const handleRegenerate = () => {
    if (lastUserMessage && !isThinking) {
      handleAISubmit(lastUserMessage)
    }
  }

  const nickname = userProfile?.first_name || 'friend'

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
            <div key={idx} style={{
              background: 'rgba(255,255,255,0.2)',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>
                  {notif.type === 'insight' ? '💡' : notif.type === 'warning' ? '⚠️' : notif.type === 'achievement' ? '🏆' : '💰'}
                </span>
                <div>
                  <p style={{ margin: 0, fontWeight: 'bold' }}>{notif.message}</p>
                </div>
              </div>
              {onDismissNotification && (
                <button onClick={() => onDismissNotification(idx)} style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '18px'
                }}>×</button>
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
          onClick={() => handleAISubmit()}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
            {isProMode && (
              <button
                onClick={isSpeaking ? stopSpeaking : () => speak(lastResponse)}
                disabled={isThinking}
                style={{
                  background: isSpeaking ? 'rgba(239, 68, 68, 0.4)' : 'rgba(255,255,255,0.15)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: '6px',
                  color: 'white',
                  cursor: isThinking ? 'not-allowed' : 'pointer',
                  padding: '5px 12px',
                  fontSize: '13px'
                }}
              >
                {isSpeaking ? '⏹️ Stop' : '🔊 Listen'}
              </button>
            )}
            {isProMode && lastUserMessage && (
              <button
                onClick={handleRegenerate}
                disabled={isThinking}
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: '6px',
                  color: 'white',
                  cursor: isThinking ? 'not-allowed' : 'pointer',
                  padding: '5px 12px',
                  fontSize: '13px'
                }}
              >
                🔄 Regenerate
              </button>
            )}
            {isSpeaking && (
              <span style={{ fontSize: '12px', opacity: 0.8 }}>Speaking...</span>
            )}
          </div>
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