import { useState, useRef, useEffect } from 'react'

export default function ChatAssistant({ expenses, categories, isProMode, onUpgradeToPro }) {
  const [chatInput, setChatInput] = useState('')
  const [chatHistory, setChatHistory] = useState([])
  const [isThinking, setIsThinking] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const recognitionRef = useRef(null)
  const utteranceRef = useRef(null)

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.continuous = false

    recognition.onstart = () => {
      setIsListening(true)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognition.onerror = () => {
      setIsListening(false)
    }

    recognition.onresult = (event) => {
      const text = event?.results?.[0]?.[0]?.transcript || ''
      if (text.trim()) {
        setChatInput(text.trim())
        // Auto-submit after voice input
        setTimeout(() => handleChatSubmit(text.trim()), 100)
      }
    }

    recognitionRef.current = recognition
  }, [])

  const startListening = () => {
    if (!recognitionRef.current) return
    // Stop any ongoing speech
    if (utteranceRef.current) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
    }
    try {
      recognitionRef.current.start()
    } catch (err) {
      console.error('Recognition error:', err)
    }
  }

  const stopListening = () => {
    if (!recognitionRef.current) return
    recognitionRef.current.stop()
  }

  const speak = (text) => {
    if (!text) return
    
    // Cancel any ongoing speech
    window.speechSynthesis.cancel()
    
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1.0
    utterance.pitch = 1.0
    utterance.volume = 1.0
    
    utterance.onstart = () => {
      setIsSpeaking(true)
    }
    
    utterance.onend = () => {
      setIsSpeaking(false)
      utteranceRef.current = null
    }
    
    utterance.onerror = () => {
      setIsSpeaking(false)
      utteranceRef.current = null
    }
    
    utteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
  }

  const stopSpeaking = () => {
    window.speechSynthesis.cancel()
    setIsSpeaking(false)
    utteranceRef.current = null
  }

  const handleChatSubmit = async (voiceInput = null) => {
    const userMessage = voiceInput || chatInput.trim()
    if (!userMessage) return

    setChatInput('')
    setChatHistory(prev => [...prev, { role: 'user', content: userMessage }])
    setIsThinking(true)

    try {
      // Prepare expense data for AI
      const expenseData = expenses.map(e => ({
        merchant: e.merchant,
        amount: Number(e.amount),
        date: new Date(e.spent_at).toISOString().split('T')[0],
        category: categories.find(c => c.id === e.category_id)?.name || 'Other',
        paymentMethod: e.payment_method,
        taxDeductible: e.is_tax_deductible,
        reimbursable: e.is_reimbursable,
        notes: e.notes
      }))

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are a helpful spending assistant with a friendly conversational tone. Answer questions about user expenses naturally, as if speaking to them. Current date: ${new Date().toISOString().split('T')[0]}.

Expenses data:
${JSON.stringify(expenseData, null, 2)}

Rules:
- Be conversational and friendly (you're being spoken to via voice)
- Keep responses concise (under 100 words when possible)
- Include merchant names and amounts when relevant
- For date ranges, interpret "last month", "this month", "last week" relative to current date
- If user asks about receipts, mention if one exists
- Use natural speech patterns (avoid bullet points, use commas instead)`
            },
            ...chatHistory.map(msg => ({ role: msg.role, content: msg.content })),
            { role: 'user', content: userMessage }
          ],
          max_tokens: 300,
          temperature: 0.5
        })
      })

      if (!response.ok) {
        throw new Error(`AI API error: ${response.status}`)
      }

      const data = await response.json()
      const aiMessage = data?.choices?.[0]?.message?.content?.trim()

      if (!aiMessage) {
        throw new Error('No response from AI')
      }

      setChatHistory(prev => [...prev, { role: 'assistant', content: aiMessage }])
      
      // Speak the response
      speak(aiMessage)

    } catch (err) {
      console.error('Chat error:', err)
      const errorMsg = `Sorry, I couldn't process that. ${err.message}`
      setChatHistory(prev => [...prev, { 
        role: 'assistant', 
        content: errorMsg
      }])
      speak(errorMsg)
    } finally {
      setIsThinking(false)
    }
  }

  if (!isProMode) {
    return (
      <div style={{ marginTop: 30 }}>
        <div style={{
          padding: 20,
          border: '2px dashed #ff9800',
          borderRadius: 12,
          textAlign: 'center',
          backgroundColor: '#fff8e1'
        }}>
          <h3 style={{ marginTop: 0 }}>🎙️ Unlock AI Voice Assistant</h3>
          <p style={{ marginBottom: 16 }}>Have full voice conversations with AI! Ask: "What day did I buy my suit from Macy's?" and AI will speak back to you.</p>
          <button 
            onClick={onUpgradeToPro}
            style={{
              padding: '10px 24px',
              fontSize: 16,
              backgroundColor: '#ff9800',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Upgrade to Pro
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 30 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>🎙️ AI Voice Assistant</h2>
        <button 
          onClick={() => setShowChat(!showChat)}
          style={{
            padding: '8px 16px',
            fontSize: 14,
            border: '1px solid #4A90E2',
            borderRadius: 6,
            backgroundColor: 'white',
            color: '#4A90E2',
            cursor: 'pointer',
            fontWeight: 600
          }}
        >
          {showChat ? 'Hide Chat' : 'Show Chat'}
        </button>
      </div>

      {showChat && (
        <div style={{
          border: '2px solid #4A90E2',
          borderRadius: 12,
          padding: 20,
          backgroundColor: '#f8f9fa'
        }}>
          {/* Voice controls */}
          <div style={{ marginBottom: 16, display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button
              onClick={isListening ? stopListening : startListening}
              disabled={isThinking || isSpeaking}
              style={{
                padding: '16px 32px',
                fontSize: 18,
                fontWeight: 600,
                border: 'none',
                borderRadius: 12,
                backgroundColor: isListening ? '#ff5252' : '#4caf50',
                color: 'white',
                cursor: isThinking || isSpeaking ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                transition: 'all 0.3s'
              }}
            >
              {isListening ? '🔴 Stop Listening' : '🎤 Start Voice'}
            </button>
            
            {isSpeaking && (
              <button
                onClick={stopSpeaking}
                style={{
                  padding: '16px 32px',
                  fontSize: 18,
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: 12,
                  backgroundColor: '#ff9800',
                  color: 'white',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                }}
              >
                🔇 Stop Speaking
              </button>
            )}
          </div>

          {(isListening || isThinking || isSpeaking) && (
            <div style={{ 
              textAlign: 'center', 
              marginBottom: 16,
              padding: 12,
              backgroundColor: '#e3f2fd',
              borderRadius: 8,
              fontWeight: 600,
              color: '#1976d2'
            }}>
              {isListening && '🎙️ Listening...'}
              {isThinking && '🤔 Thinking...'}
              {isSpeaking && '🔊 Speaking...'}
            </div>
          )}

          {/* Chat history */}
          <div style={{
            maxHeight: 400,
            overflowY: 'auto',
            marginBottom: 16,
            backgroundColor: 'white',
            borderRadius: 8,
            padding: 16
          }}>
            {chatHistory.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#666', fontStyle: 'italic' }}>
                <p style={{ fontSize: 18, marginBottom: 16 }}>🎙️ Click "Start Voice" and ask me anything!</p>
                <p style={{ fontSize: 14 }}>Try saying:</p>
                <ul style={{ textAlign: 'left', marginTop: 10 }}>
                  <li>"What day did I buy my suit from Macy's?"</li>
                  <li>"How much did I spend on gas last month?"</li>
                  <li>"Show me all my Starbucks purchases"</li>
                  <li>"What's my average daily spending?"</li>
                </ul>
              </div>
            ) : (
              chatHistory.map((msg, idx) => (
                <div 
                  key={idx} 
                  style={{
                    marginBottom: 12,
                    padding: 12,
                    borderRadius: 8,
                    backgroundColor: msg.role === 'user' ? '#e3f2fd' : '#f1f8e9',
                    textAlign: msg.role === 'user' ? 'right' : 'left'
                  }}
                >
                  <div style={{ 
                    fontWeight: 600, 
                    marginBottom: 4,
                    color: msg.role === 'user' ? '#1976d2' : '#388e3c'
                  }}>
                    {msg.role === 'user' ? '🗣️ You' : '🤖 AI'}
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                </div>
              ))
            )}
          </div>

          {/* Text input fallback */}
          <details style={{ marginTop: 16 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600, marginBottom: 12 }}>
              Or type your question
            </summary>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !isThinking) handleChatSubmit()
                }}
                placeholder="Type your question..."
                disabled={isThinking}
                style={{
                  flex: 1,
                  padding: '12px',
                  fontSize: 16,
                  border: '1px solid #ddd',
                  borderRadius: 8,
                  boxSizing: 'border-box'
                }}
              />
              <button
                onClick={() => handleChatSubmit()}
                disabled={isThinking || !chatInput.trim()}
                style={{
                  padding: '12px 24px',
                  fontSize: 16,
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: 8,
                  backgroundColor: isThinking || !chatInput.trim() ? '#ccc' : '#4A90E2',
                  color: 'white',
                  cursor: isThinking || !chatInput.trim() ? 'not-allowed' : 'pointer'
                }}
              >
                Send
              </button>
            </div>
          </details>

          {chatHistory.length > 0 && (
            <button
              onClick={() => {
                setChatHistory([])
                stopSpeaking()
              }}
              style={{
                marginTop: 12,
                padding: '8px 16px',
                fontSize: 14,
                border: '1px solid #ddd',
                borderRadius: 6,
                backgroundColor: 'white',
                cursor: 'pointer'
              }}
            >
              Clear Chat
            </button>
          )}
        </div>
      )}
    </div>
  )
}
