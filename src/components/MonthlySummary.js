import React, { useState, useEffect, useMemo } from 'react'

function MonthlySummary({ expenses, categories, isProMode }) {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [aiInsights, setAiInsights] = useState([])
  const [loadingInsights, setLoadingInsights] = useState(false)

  // Calculate monthly summary
  const summary = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number)
    const filtered = expenses.filter(e => {
      const date = new Date(e.spent_at)
      return date.getFullYear() === year && date.getMonth() === month - 1
    })

    const total = filtered.reduce((sum, e) => sum + Number(e.amount), 0)

    const byCategory = {}
    filtered.forEach(e => {
      const cat = categories.find(c => c.id === e.category_id)
      const catName = cat ? cat.name : 'Uncategorized'
      byCategory[catName] = (byCategory[catName] || 0) + Number(e.amount)
    })

    return { filtered, total, byCategory }
  }, [expenses, categories, selectedMonth])

  // Calculate previous month summary for comparison
  const previousMonthSummary = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number)
    const prevMonth = month === 1 ? 12 : month - 1
    const prevYear = month === 1 ? year - 1 : year

    const filtered = expenses.filter(e => {
      const date = new Date(e.spent_at)
      return date.getFullYear() === prevYear && date.getMonth() === prevMonth - 1
    })

    return filtered.reduce((sum, e) => sum + Number(e.amount), 0)
  }, [expenses, selectedMonth])

  const monthChange = previousMonthSummary > 0
    ? ((summary.total - previousMonthSummary) / previousMonthSummary) * 100
    : 0

  // Generate month options (last 12 months)
  const monthOptions = useMemo(() => {
    const options = []
    const now = new Date()
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      options.push({ value, label })
    }
    return options
  }, [])

  // AI Insights (Pro only)
  useEffect(() => {
    if (!isProMode || !summary || summary.filtered.length === 0) {
      setAiInsights([])
      return
    }

    const generateAIInsights = async () => {
      setLoadingInsights(true)
      try {
        // Prepare expense data for AI analysis
        const expenseData = summary.filtered.map(e => ({
          merchant: e.merchant,
          amount: Number(e.amount),
          date: new Date(e.spent_at).toISOString().split('T')[0],
          category: categories.find(c => c.id === e.category_id)?.name || 'Other'
        }))

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messages: [
              {
                role: 'user',
                content: `Analyze these monthly expenses and provide 3-5 actionable insights. Focus on:
- Duplicate transactions (same merchant, similar amount, same day)
- Potential subscriptions (recurring merchant, similar amounts)
- Spending spikes (unusual high amounts for specific merchants)
- Category trends

Expenses:
${JSON.stringify(expenseData, null, 2)}

Return ONLY a JSON array of insight strings (no markdown, no code fence):
["🔄 insight 1", "💳 insight 2", "⚠️ insight 3"]

Rules:
- Max 5 insights
- Be specific with merchant names and amounts
- Use emojis: 🔄 (duplicate), 💳 (subscription), ⚠️ (spike), 💡 (trend)
- Keep each insight under 100 characters`
              }
            ],
            max_tokens: 500
          })
        })

        const data = await response.json()
        const content = data.choices[0].message.content.trim()

        // Parse JSON response (handle code fence if present)
        const jsonMatch = content.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
          const insights = JSON.parse(jsonMatch[0])
          setAiInsights(insights.slice(0, 5))
        }
      } catch (err) {
        console.error('AI Insights error:', err)
        setAiInsights([])
      } finally {
        setLoadingInsights(false)
      }
    }

    generateAIInsights()
  }, [summary, categories, isProMode])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h2 style={{ margin: 0 }}>Monthly Summary</h2>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          style={{
            padding: '8px 12px',
            border: '2px solid #e5e7eb',
            borderRadius: '8px',
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          {monthOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '15px',
        marginBottom: '20px'
      }}>
        <div style={{
          padding: '20px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '12px',
          color: 'white'
        }}>
          <p style={{ margin: '0 0 5px 0', opacity: 0.9, fontSize: '14px' }}>Total Spent</p>
          <p style={{ margin: 0, fontSize: '32px', fontWeight: 'bold' }}>${summary.total.toFixed(2)}</p>
          {previousMonthSummary > 0 && (
            <p style={{ margin: '5px 0 0 0', fontSize: '12px', opacity: 0.8 }}>
              {monthChange >= 0 ? '↑' : '↓'} {Math.abs(monthChange).toFixed(1)}% vs last month
            </p>
          )}
        </div>

        <div style={{
          padding: '20px',
          background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          borderRadius: '12px',
          color: 'white'
        }}>
          <p style={{ margin: '0 0 5px 0', opacity: 0.9, fontSize: '14px' }}>Transactions</p>
          <p style={{ margin: 0, fontSize: '32px', fontWeight: 'bold' }}>{summary.filtered.length}</p>
          <p style={{ margin: '5px 0 0 0', fontSize: '12px', opacity: 0.8 }}>
            Avg: ${summary.filtered.length > 0 ? (summary.total / summary.filtered.length).toFixed(2) : '0.00'}
          </p>
        </div>
      </div>

      {isProMode && loadingInsights && (
        <div style={{
          padding: '15px',
          background: '#f3f4f6',
          borderRadius: '8px',
          marginBottom: '15px',
          textAlign: 'center',
          color: '#6b7280'
        }}>
          🤖 Analyzing your spending patterns...
        </div>
      )}

      {isProMode && aiInsights.length > 0 && (
        <div style={{
          padding: '15px',
          background: 'linear-gradient(135deg, #ffeaa7 0%, #fdcb6e 100%)',
          borderRadius: '8px',
          marginBottom: '15px'
        }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>🤖 AI Insights (PRO)</h3>
          {aiInsights.map((insight, idx) => (
            <p key={idx} style={{ margin: '5px 0', fontSize: '14px' }}>{insight}</p>
          ))}
        </div>
      )}

      <div>
        <h3 style={{ marginBottom: '10px' }}>By Category</h3>
        {Object.entries(summary.byCategory).length === 0 ? (
          <p style={{ color: '#6b7280' }}>No expenses this month</p>
        ) : (
          Object.entries(summary.byCategory)
            .sort(([, a], [, b]) => b - a)
            .map(([cat, amount]) => (
              <div key={cat} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px',
                background: '#f9fafb',
                borderRadius: '6px',
                marginBottom: '8px'
              }}>
                <span style={{ fontWeight: '500' }}>{cat}</span>
                <span style={{ color: '#6b7280' }}>${amount.toFixed(2)}</span>
              </div>
            ))
        )}
      </div>
    </div>
  )
}

export default MonthlySummary
