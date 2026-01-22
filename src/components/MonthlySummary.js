import { useMemo, useState, useEffect } from 'react'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

export default function MonthlySummary({ expenses, categories, isProMode, onUpgradeToPro }) {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth())
  const [aiInsights, setAiInsights] = useState([])
  const [loadingInsights, setLoadingInsights] = useState(false)

  const monthOptions = useMemo(() => {
    if (!expenses || expenses.length === 0) return []

    const months = new Set()
    expenses.forEach(e => {
      const d = new Date(e.spent_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      months.add(key)
    })

    const sorted = Array.from(months).sort().reverse()
    return sorted
  }, [expenses])

  const summary = useMemo(() => {
    if (!selectedMonth) return null

    const [year, month] = selectedMonth.split('-').map(Number)

    const filtered = expenses.filter(e => {
      const d = new Date(e.spent_at)
      return d.getFullYear() === year && d.getMonth() + 1 === month
    })

    if (filtered.length === 0) return null

    const total = filtered.reduce((sum, e) => sum + Number(e.amount), 0)

    const byCategory = {}
    filtered.forEach(e => {
      const catId = e.category_id
      if (!byCategory[catId]) {
        byCategory[catId] = { amount: 0, count: 0 }
      }
      byCategory[catId].amount += Number(e.amount)
      byCategory[catId].count += 1
    })

    const breakdown = Object.keys(byCategory).map(catId => {
      const cat = categories.find(c => c.id === catId)
      return {
        categoryId: catId,
        categoryName: cat ? cat.name : '—',
        amount: byCategory[catId].amount,
        count: byCategory[catId].count
      }
    }).sort((a, b) => b.amount - a.amount)

    // Tax & Reimbursement totals
    const taxDeductible = filtered
      .filter(e => e.is_tax_deductible)
      .reduce((sum, e) => sum + Number(e.amount), 0)

    const reimbursable = filtered
      .filter(e => e.is_reimbursable)
      .reduce((sum, e) => sum + Number(e.amount), 0)

    const taxCount = filtered.filter(e => e.is_tax_deductible).length
    const reimbursableCount = filtered.filter(e => e.is_reimbursable).length

    return { 
      total, 
      breakdown, 
      count: filtered.length,
      taxDeductible,
      taxCount,
      reimbursable,
      reimbursableCount,
      filtered
    }
  }, [expenses, categories, selectedMonth])

  const previousMonthSummary = useMemo(() => {
    if (!selectedMonth) return null

    const [year, month] = selectedMonth.split('-').map(Number)
    
    let prevYear = year
    let prevMonth = month - 1
    if (prevMonth === 0) {
      prevMonth = 12
      prevYear -= 1
    }

    const filtered = expenses.filter(e => {
      const d = new Date(e.spent_at)
      return d.getFullYear() === prevYear && d.getMonth() + 1 === prevMonth
    })

    if (filtered.length === 0) return null

    const total = filtered.reduce((sum, e) => sum + Number(e.amount), 0)
    return { total }
  }, [expenses, selectedMonth])

  const insights = useMemo(() => {
    if (!summary) return []

    const result = []

    // Top category
    if (summary.breakdown.length > 0) {
      const top = summary.breakdown[0]
      result.push(`💡 Your top spending category this month: ${top.categoryName} ($${top.amount.toFixed(2)})`)
    }

    // Average daily spend
    const daysInMonth = new Date(
      parseInt(selectedMonth.split('-')[0]),
      parseInt(selectedMonth.split('-')[1]),
      0
    ).getDate()
    const avgDaily = summary.total / daysInMonth
    result.push(`📊 Average daily spend: $${avgDaily.toFixed(2)}`)

    // Compare to previous month (Pro only)
    if (isProMode && previousMonthSummary) {
      const diff = summary.total - previousMonthSummary.total
      const percentChange = ((diff / previousMonthSummary.total) * 100).toFixed(1)
      
      if (diff > 0) {
        result.push(`📈 You spent ${Math.abs(percentChange)}% more than last month (+$${diff.toFixed(2)})`)
      } else if (diff < 0) {
        result.push(`📉 You spent ${Math.abs(percentChange)}% less than last month (-$${Math.abs(diff).toFixed(2)})`)
      } else {
        result.push(`➡️ Your spending is the same as last month`)
      }
    }

    return result
  }, [summary, previousMonthSummary, selectedMonth, isProMode])

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
            max_tokens: 500,
            temperature: 0.3
          })
        })

        if (!response.ok) {
          throw new Error(`AI API error: ${response.status}`)
        }

        const data = await response.json()
        const content = data?.choices?.[0]?.message?.content?.trim()

        if (!content) {
          throw new Error('No insights from AI')
        }

        // Parse JSON (strip markdown if present)
        let jsonText = content
        if (jsonText.startsWith('```')) {
          jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        }

        const parsed = JSON.parse(jsonText)
        setAiInsights(Array.isArray(parsed) ? parsed : [])

      } catch (err) {
        console.error('AI Insights error:', err)
        setAiInsights([])
      } finally {
        setLoadingInsights(false)
      }
    }

    generateAIInsights()
  }, [summary, isProMode, categories])

  const chartData = useMemo(() => {
    if (!summary) return null

    return {
      labels: summary.breakdown.map(r => r.categoryName),
      datasets: [
        {
          label: 'Amount ($)',
          data: summary.breakdown.map(r => r.amount),
          backgroundColor: 'rgba(54, 162, 235, 0.6)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1
        }
      ]
    }
  }, [summary])

  const chartOptions = {
    indexAxis: 'y',
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: false }
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: {
          callback: (value) => `$${value}`
        }
      }
    }
  }

  if (!monthOptions || monthOptions.length === 0) {
    return (
      <div style={{ marginTop: 30 }}>
        <h2>Monthly Summary</h2>
        <p>No expenses to summarize yet.</p>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 30 }}>
      <h2>Monthly Summary</h2>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span>Select month:</span>
          <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
            {monthOptions.map(m => (
              <option key={m} value={m}>
                {formatMonthLabel(m)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {summary ? (
        <div>
          <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>
            Total: ${summary.total.toFixed(2)} ({summary.count} expenses)
          </div>

          {(summary.taxDeductible > 0 || summary.reimbursable > 0) && isProMode ? (
            <div style={{
              marginBottom: 20,
              padding: 16,
              backgroundColor: '#fff9e6',
              borderRadius: 10,
              border: '1px solid #ffd700'
            }}>
              <h3 style={{ marginTop: 0, marginBottom: 12 }}>Tax & Reimbursement</h3>
              {summary.taxDeductible > 0 ? (
                <div style={{ marginBottom: 8 }}>
                  💼 Tax deductible: <strong>${summary.taxDeductible.toFixed(2)}</strong> ({summary.taxCount} expenses)
                </div>
              ) : null}
              {summary.reimbursable > 0 ? (
                <div>
                  💵 Reimbursable: <strong>${summary.reimbursable.toFixed(2)}</strong> ({summary.reimbursableCount} expenses)
                </div>
              ) : null}
            </div>
          ) : null}

          {insights.length > 0 ? (
            <div style={{ 
              marginBottom: 20, 
              padding: 16, 
              backgroundColor: '#f8f9fa', 
              borderRadius: 10,
              border: '1px solid #e0e0e0'
            }}>
              <h3 style={{ marginTop: 0, marginBottom: 12 }}>Insights</h3>
              {insights.map((insight, idx) => (
                <div key={idx} style={{ marginBottom: 8, lineHeight: 1.5 }}>
                  {insight}
                </div>
              ))}
            </div>
          ) : null}

          {/* AI Insights (Pro only) */}
          {isProMode && (
            <div style={{ 
              marginBottom: 20, 
              padding: 16, 
              backgroundColor: '#e8f5e9', 
              borderRadius: 10,
              border: '2px solid #4caf50'
            }}>
              <h3 style={{ marginTop: 0, marginBottom: 12, color: '#2e7d32' }}>🤖 AI-Powered Insights</h3>
              {loadingInsights ? (
                <div style={{ fontStyle: 'italic', color: '#666' }}>Analyzing your spending patterns...</div>
              ) : aiInsights.length > 0 ? (
                aiInsights.map((insight, idx) => (
                  <div key={idx} style={{ marginBottom: 8, lineHeight: 1.5, fontWeight: 500 }}>
                    {insight}
                  </div>
                ))
              ) : (
                <div style={{ fontStyle: 'italic', color: '#666' }}>No AI insights available for this period.</div>
              )}
            </div>
          )}

          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 30 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ddd', textAlign: 'left' }}>
                <th style={{ padding: 8 }}>Category</th>
                <th style={{ padding: 8 }}>Amount</th>
                <th style={{ padding: 8 }}>Count</th>
              </tr>
            </thead>
            <tbody>
              {summary.breakdown.map(row => (
                <tr key={row.categoryId} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: 8 }}>{row.categoryName}</td>
                  <td style={{ padding: 8 }}>${row.amount.toFixed(2)}</td>
                  <td style={{ padding: 8 }}>{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {isProMode && chartData ? (
            <div style={{ maxWidth: 600 }}>
              <h3>Spending by Category</h3>
              <Bar data={chartData} options={chartOptions} />
            </div>
          ) : !isProMode ? (
            <div style={{
              maxWidth: 600,
              padding: 20,
              border: '2px dashed #ff9800',
              borderRadius: 12,
              textAlign: 'center',
              backgroundColor: '#fff8e1'
            }}>
              <h3 style={{ marginTop: 0 }}>📊 Unlock Charts & AI Insights</h3>
              <p style={{ marginBottom: 16 }}>Upgrade to Pro to visualize your spending with beautiful charts and get AI-powered predictions.</p>
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
          ) : null}
        </div>
      ) : (
        <p>No expenses for this month.</p>
      )}
    </div>
  )
}

function getCurrentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatMonthLabel(monthKey) {
  const [year, month] = monthKey.split('-')
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${monthNames[Number(month) - 1]} ${year}`
}
