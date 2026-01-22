import { useState } from 'react'

export default function ChatAssistant({ expenses, categories, isProMode, onUpgradeToPro }) {
  const [chatInput, setChatInput] = useState('')
  const [chatHistory, setChatHistory] = useState([])
  const [isThinking, setIsThinking] = useState(false)
  const [showChat, setShowChat] = useState(false)

  const handleChatSubmit = async () => {
    if (!chatInput.trim()) return

    const userMessage = chatInput.trim()
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
              content: `You are a helpful spending assistant. Answer questions about user expenses concisely. Current date: ${new Date().toISOString().split('T')[0]}.

Expenses data:
${JSON.stringify(expenseData, null, 2)}

Rules:
- Be concise and specific
- Include merchant names and amounts when relevant
- Use clear formatting (bullets for lists)
- If asked for totals, calculate accurately
- For date ranges, interpret "last month", "this month", "last week" relative to current date`
            },
            ...chatHistory.map(msg => ({ role: msg.role, content: msg.content })),
            { role: 'user', content: userMessage }
          ],
          max_tokens: 500,
          temperature: 0.3
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

    } catch (err) {
      console.error('Chat error:', err)
      setChatHistory(prev => [...prev, { 
        role: 'assistant', 
        content: `⚠️ Sorry, I couldn't process that. Error: ${err.message}` 
      }])
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
          <h3 style={{ marginTop: 0 }}>💬 Unlock AI Chat Assistant</h3>
          <p style={{ marginBottom: 16 }}>Ask natural language questions like: "How much did I spend on gas last month?" or "Show me all Starbucks purchases"</p>
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
        <h2 style={{ margin: 0 }}>💬 AI Chat Assistant</h2>
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
                Ask me anything about your spending! Try:
                <ul style={{ textAlign: 'left', marginTop: 10 }}>
                  <li>"How much did I spend on gas last month?"</li>
                  <li>"Show me all Starbucks purchases"</li>
                  <li>"What's my average daily spending?"</li>
                  <li>"How much did I spend this week?"</li>
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
                    {msg.role === 'user' ? 'You' : 'AI Assistant'}
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                </div>
              ))
            )}
            {isThinking && (
              <div style={{
                padding: 12,
                borderRadius: 8,
                backgroundColor: '#f1f8e9',
                fontStyle: 'italic',
                color: '#666'
              }}>
                AI is thinking...
              </div>
            )}
          </div>

          {/* Input area */}
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !isThinking) handleChatSubmit()
              }}
              placeholder="Ask about your spending..."
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
              onClick={handleChatSubmit}
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
              {isThinking ? '...' : 'Send'}
            </button>
          </div>

          {chatHistory.length > 0 && (
            <button
              onClick={() => setChatHistory([])}
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
