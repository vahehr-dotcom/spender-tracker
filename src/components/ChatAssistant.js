import { useState, useRef, useEffect } from 'react'

export default function ChatAssistant({ 
  expenses, 
  categories, 
  isProMode, 
  onUpgradeToPro,
  onAICommand
}) {
  const [aiInput, setAiInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [lastResponse, setLastResponse] = useState('')
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
        setAiInput(text.trim())
        setTimeout(() => handleAISubmit(text.trim()), 100)
      }
    }

    recognitionRef.current = recognition
  }, [expenses, categories])

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

  const handleAISubmit = async (voiceInput = null) => {
    const userMessage = voiceInput || aiInput.trim()
    if (!userMessage) return

    setAiInput('')
    setIsThinking(true)
    setLastResponse('')

    // FIRST: Try to parse and execute command BEFORE calling AI
    if (onAICommand) {
      const commandExecuted = parseAndExecuteCommand(userMessage)
      if (commandExecuted) {
        setIsThinking(false)
        setLastResponse('✓ Command executed—check the form below!')
        speak('Done! Check the form below to review and save.')
        return
      }
    }

    // If no command detected, proceed with AI conversation
    try {
      const expenseData = expenses.map(e => ({
        id: e.id,
        merchant: e.merchant,
        amount: Number(e.amount),
        date: new Date(e.spent_at).toISOString().split('T')[0],
        category: categories.find(c => c.id === e.category_id)?.name || 'Other',
        paymentMethod: e.payment_method,
        taxDeductible: e.is_tax_deductible,
        reimbursable: e.is_reimbursable,
        notes: e.notes
      }))

      const systemPrompt = isProMode 
        ? `You are an elite AI financial advisor and personal accountant—intelligent, attentive, and always present. You speak with the authority of a trusted wealth advisor.

Current date: ${new Date().toISOString().split('T')[0]}

Client's expense data:
${JSON.stringify(expenseData, null, 2)}

Communication style:
- Professional yet warm—private wealth advisor, not chatbot
- Proactive: anticipate needs, offer insights beyond what's asked
- Precise with numbers: include amounts, dates, merchant names
- Context-aware: reference patterns, trends, anomalies
- Natural, flowing language (you're speaking, not writing)
- Focused responses (60-120 words)
- Follow up with relevant questions/suggestions when appropriate

Pro features available: Deep analysis, spending trends, predictions, tax optimization.`
        : `You are a helpful AI expense assistant. You can answer basic questions about spending.

Current date: ${new Date().toISOString().split('T')[0]}

Expense data:
${JSON.stringify(expenseData, null, 2)}

Keep responses brief (40-80 words). For advanced analysis, insights, or predictions, mention: "Upgrade to Pro for deep financial analysis."

Basic features: View expenses, search by merchant/date, simple totals.`

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          max_tokens: isProMode ? 400 : 200,
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

      setLastResponse(aiMessage)
      speak(aiMessage)

    } catch (err) {
      console.error('AI error:', err)
      const errorMsg = `I apologize—I'm having trouble right now. Please try again.`
      setLastResponse(errorMsg)
      speak(errorMsg)
    } finally {
      setIsThinking(false)
    }
  }

  const parseAndExecuteCommand = (userMsg) => {
    const lowerUser = userMsg.toLowerCase()

    // Detect: "add expense", "create expense", "spent", "bought"
    if (lowerUser.includes('add') || lowerUser.includes('create') || lowerUser.includes('spent') || lowerUser.includes('bought')) {
      // Parse amount
      const amountMatch = userMsg.match(/(\d+\.?\d*)/)
      const amount = amountMatch ? parseFloat(amountMatch[1]) : null

      // Parse merchant (look for "at X" pattern)
      let merchant = ''
      const atMatch = userMsg.match(/at\s+([a-z0-9\s]+?)(?:\s+yesterday|\s+today|\s+last|\s+\d+\s+days|\s*$)/i)
      if (atMatch) {
        merchant = atMatch[1].trim()
      }

      // Parse date hint (yesterday, today, last week, etc.)
      let dateHint = null
      if (lowerUser.includes('yesterday')) dateHint = 'yesterday'
      else if (lowerUser.includes('today')) dateHint = 'today'
      else if (lowerUser.match(/(\d+)\s*days?\s*ago/)) {
        const match = lowerUser.match(/(\d+)\s*days?\s*ago/)
        dateHint = `${match[1]} days ago`
      }
      else if (lowerUser.includes('last week')) dateHint = 'last week'
      else if (lowerUser.includes('last month')) dateHint = 'last month'
      else if (lowerUser.includes('last monday')) dateHint = 'last monday'
      else if (lowerUser.includes('last tuesday')) dateHint = 'last tuesday'
      else if (lowerUser.includes('last wednesday')) dateHint = 'last wednesday'
      else if (lowerUser.includes('last thursday')) dateHint = 'last thursday'
      else if (lowerUser.includes('last friday')) dateHint = 'last friday'
      else if (lowerUser.includes('last saturday')) dateHint = 'last saturday'
      else if (lowerUser.includes('last sunday')) dateHint = 'last sunday'
      else if (lowerUser.includes('monday')) dateHint = 'monday'
      else if (lowerUser.includes('tuesday')) dateHint = 'tuesday'
      else if (lowerUser.includes('wednesday')) dateHint = 'wednesday'
      else if (lowerUser.includes('thursday')) dateHint = 'thursday'
      else if (lowerUser.includes('friday')) dateHint = 'friday'
      else if (lowerUser.includes('saturday')) dateHint = 'saturday'
      else if (lowerUser.includes('sunday')) dateHint = 'sunday'

      if (amount && merchant) {
        onAICommand({ 
          action: 'add_expense', 
          data: { amount, merchant, dateHint } 
        })
        return true // Command executed
      }
    }

    // Detect: "show receipts", "filter by", "search for"
    if (lowerUser.includes('show') || lowerUser.includes('filter') || lowerUser.includes('search')) {
      const searchTermMatch = userMsg.match(/(receipts?|expenses?)\s+(from|for|at)\s+([a-z0-9\s]+)/i)
      if (searchTermMatch) {
        onAICommand({
          action: 'search',
          data: { query: searchTermMatch[3].trim() }
        })
        return true
      }
    }

    // Detect: "export", "download"
    if (lowerUser.includes('export') || lowerUser.includes('download')) {
      onAICommand({ action: 'export' })
      return true
    }

    return false // No command detected
  }

  return (
    <div style={{ 
      padding: '24px 0',
      maxWidth: 600,
      margin: '0 auto',
      fontFamily: 'system-ui, sans-serif'
    }}>
      {/* AI Input Interface */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: 16,
        padding: 24,
        boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)',
        marginBottom: 20
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 12,
          marginBottom: 16
        }}>
          <div style={{ fontSize: 32 }}>🧠</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'white' }}>
              Your AI Assistant
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>
              {isProMode ? 'Elite advisor mode • Always ready' : 'Basic mode • Upgrade for deep insights'}
            </div>
          </div>
        </div>

        {/* Input + Voice */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            type="text"
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAISubmit()
            }}
            placeholder="How can I help you today?"
            disabled={isThinking || isListening}
            style={{
              flex: 1,
              padding: '14px 18px',
              fontSize: 16,
              border: 'none',
              borderRadius: 12,
              backgroundColor: 'white',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              outline: 'none'
            }}
          />
          <button
            onClick={isListening ? stopListening : startListening}
            disabled={isThinking}
            style={{
              padding: '14px 20px',
              fontSize: 20,
              border: 'none',
              borderRadius: 12,
              background: isListening ? '#ff5252' : 'white',
              color: isListening ? 'white' : '#667eea',
              cursor: isThinking ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              transition: 'transform 0.2s',
              opacity: isThinking ? 0.5 : 1
            }}
            onMouseOver={e => !isThinking && (e.target.style.transform = 'scale(1.05)')}
            onMouseOut={e => e.target.style.transform = 'scale(1)'}
          >
            {isListening ? '⏸' : '🎤'}
          </button>
        </div>

        {/* Status indicators */}
        {(isListening || isThinking || isSpeaking) && (
          <div style={{
            marginTop: 12,
            padding: '10px 14px',
            borderRadius: 10,
            background: 'rgba(255,255,255,0.2)',
            color: 'white',
            fontSize: 14,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            {isListening && <>🎙️ Listening...</>}
            {isThinking && <>⏳ Thinking...</>}
            {isSpeaking && (
              <>
                🔊 Speaking...
                <button
                  onClick={stopSpeaking}
                  style={{
                    marginLeft: 'auto',
                    padding: '4px 12px',
                    fontSize: 12,
                    border: 'none',
                    borderRadius: 6,
                    background: 'rgba(0,0,0,0.2)',
                    color: 'white',
                    cursor: 'pointer'
                  }}
                >
                  Stop
                </button>
              </>
            )}
          </div>
        )}

        {/* Last AI Response */}
        {lastResponse && (
          <div style={{
            marginTop: 16,
            padding: 16,
            borderRadius: 12,
            background: 'rgba(255,255,255,0.95)',
            fontSize: 15,
            lineHeight: 1.6,
            color: '#333'
          }}>
            <div style={{ fontWeight: 700, marginBottom: 8, color: '#667eea' }}>
              AI Response:
            </div>
            {lastResponse}
          </div>
        )}

        {/* Pro teaser for free users */}
        {!isProMode && (
          <div style={{
            marginTop: 16,
            padding: '12px 16px',
            borderRadius: 10,
            background: 'rgba(255,255,255,0.15)',
            color: 'white',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12
          }}>
            <span>✨ Get deep insights, trends, predictions</span>
            <button
              onClick={onUpgradeToPro}
              style={{
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: 700,
                border: 'none',
                borderRadius: 8,
                background: 'white',
                color: '#667eea',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              Upgrade
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
