import { useState, useRef, useEffect } from 'react'

export default function ChatAssistant({ expenses, categories, isProMode, onUpgradeToPro }) {
  const [chatInput, setChatInput] = useState('')
  const [chatHistory, setChatHistory] = useState([])
  const [isThinking, setIsThinking] = useState(false)
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
        setTimeout(() => handleChatSubmit(text.trim()), 100)
      }
    }

    recognitionRef.current = recognition
  }, [])

  const startListening = () => {
    if (!recognitionRef.current) return
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
    
    window.speechSynthesis.cancel()
    
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.95
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
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `You are an elite financial advisor and personal accountant—intelligent, attentive, and always present. You speak with the authority of a trusted advisor, but remain warm and personable. Your client values precision, insight, and sophistication.

Current date: ${new Date().toISOString().split('T')[0]}

Client's expense data:
${JSON.stringify(expenseData, null, 2)}

Communication style:
- Professional yet personable—think private wealth advisor, not chatbot
- Proactive: anticipate needs, offer insights beyond what's asked
- Precise with numbers: always include specific amounts, dates, merchant names
- Context-aware: reference patterns, trends, anomalies
- Confident but never arrogant
- Use natural, flowing language (you're speaking, not writing a report)
- Keep responses focused (60-120 words ideal)
- When appropriate, follow up with a relevant question or suggestion

Examples of your tone:
❌ "You spent $42.50 at Starbucks on Nov 15."
✅ "On November 15th, you had a $42.50 transaction at Starbucks. I noticed you've been there three times this month—would you like me to track your coffee spending separately?"

❌ "Last month total: $1,234"
✅ "Last month came to $1,234—about 15% higher than your October baseline. The increase was primarily in dining, particularly that $180 at Il Fornaio. Celebrating something?"

Always remember: You're their trusted financial brain, always watching, always ready.`
            },
            ...chatHistory.map(msg => ({ role: msg.role, content: msg.content })),
            { role: 'user', content: userMessage }
          ],
          max_tokens: 400,
          temperature: 0.7
        })
      })

      if (!response.ok) {
        throw new Error(`Unable to process request`)
      }

      const data = await response.json()
      const aiMessage = data?.choices?.[0]?.message?.content?.trim()

      if (!aiMessage) {
        throw new Error('No response received')
      }

      setChatHistory(prev => [...prev, { role: 'assistant', content: aiMessage }])
      speak(aiMessage)

    } catch (err) {
      console.error('Chat error:', err)
      const errorMsg = `I apologize—I'm having trouble accessing that information right now. Please try again in a moment.`
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
      <div style={{ marginTop: 40 }}>
        <div style={{
          padding: 32,
          border: '2px solid #e0e0e0',
          borderRadius: 16,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          textAlign: 'center',
          boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)'
        }}>
          <h2 style={{ marginTop: 0, fontSize: 28, fontWeight: 700 }}>Your AI Financial Advisor</h2>
          <p style={{ fontSize: 18, marginBottom: 24, opacity: 0.95 }}>
            Get instant answers through natural voice conversation. Your personal accountant, always present, always ready.
          </p>
          <button 
            onClick={onUpgradeToPro}
            style={{
              padding: '14px 32px',
              fontSize: 18,
              backgroundColor: 'white',
              color: '#667eea',
              border: 'none',
              borderRadius: 12,
              cursor: 'pointer',
              fontWeight: 700,
              boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
              transition: 'transform 0.2s'
            }}
            onMouseOver={e => e.target.style.transform = 'scale(1.05)'}
            onMouseOut={e => e.target.style.transform = 'scale(1)'}
          >
            Activate AI Advisor
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ 
      position: 'fixed',
      bottom: 24,
      right: 24,
      width: 420,
      maxHeight: '70vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      borderRadius: 20,
      boxShadow: '0 16px 48px rgba(0,0,0,0.3)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 1000,
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px',
        color: 'white',
        background: 'rgba(0,0,0,0.2)',
        backdropFilter: 'blur(10px)'
      }}>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>🧠 Your AI Advisor</div>
        <div style={{ fontSize: 13, opacity: 0.85 }}>Always present, always ready</div>
      </div>

      {/* Chat area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px',
        background: 'white'
      }}>
        {chatHistory.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#666' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎙️</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Ready when you are</div>
            <div style={{ fontSize: 14, lineHeight: 1.6, opacity: 0.8 }}>
              Just speak naturally:
              <div style={{ marginTop: 12, fontStyle: 'italic' }}>
                "What did I spend at Macy's?"<br/>
                "How's my spending this month?"<br/>
                "Any unusual transactions?"
              </div>
            </div>
          </div>
        ) : (
          chatHistory.map((msg, idx) => (
            <div 
              key={idx} 
              style={{
                marginBottom: 16,
                display: 'flex',
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                alignItems: 'flex-start',
                gap: 12
              }}
            >
              <div style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: msg.role === 'user' ? '#667eea' : '#2e7d32',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                flexShrink: 0
              }}>
                {msg.role === 'user' ? '👤' : '🧠'}
              </div>
              <div style={{
                maxWidth: '75%',
                padding: '12px 16px',
                borderRadius: 16,
                background: msg.role === 'user' ? '#f0f0f0' : '#e8f5e9',
                fontSize: 15,
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap'
              }}>
                {msg.content}
              </div>
            </div>
          ))
        )}
        {isThinking && (
          <div style={{ textAlign: 'center', padding: 20, fontStyle: 'italic', color: '#666' }}>
            Analyzing...
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{
        padding: '16px 20px',
        background: 'rgba(0,0,0,0.05)',
        borderTop: '1px solid rgba(0,0,0,0.1)'
      }}>
        {(isListening || isSpeaking) && (
          <div style={{ 
            textAlign: 'center', 
            marginBottom: 12,
            padding: 8,
            background: isListening ? '#e3f2fd' : '#fff3e0',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            color: isListening ? '#1976d2' : '#f57c00'
          }}>
            {isListening && '🎙️ Listening...'}
            {isSpeaking && '🔊 Speaking...'}
          </div>
        )}
        
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={isListening ? stopListening : startListening}
            disabled={isThinking || isSpeaking}
            style={{
              flex: 1,
              padding: '14px',
              fontSize: 16,
              fontWeight: 700,
              border: 'none',
              borderRadius: 12,
              background: isListening ? '#ff5252' : '#4caf50',
              color: 'white',
              cursor: isThinking || isSpeaking ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              opacity: isThinking || isSpeaking ? 0.5 : 1
            }}
          >
            {isListening ? '⏸ Pause' : '🎤 Speak'}
          </button>
          
          {isSpeaking && (
            <button
              onClick={stopSpeaking}
              style={{
                padding: '14px 20px',
                fontSize: 16,
                fontWeight: 700,
                border: 'none',
                borderRadius: 12,
                background: '#ff9800',
                color: 'white',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
              }}
            >
              🔇
            </button>
          )}
        </div>

        {chatHistory.length > 0 && (
          <button
            onClick={() => {
              setChatHistory([])
              stopSpeaking()
            }}
            style={{
              width: '100%',
              marginTop: 8,
              padding: '10px',
              fontSize: 13,
              border: '1px solid rgba(0,0,0,0.1)',
              borderRadius: 8,
              background: 'white',
              color: '#666',
              cursor: 'pointer'
            }}
          >
            Clear Conversation
          </button>
        )}
      </div>
    </div>
  )
}
