import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { supabase } from './supabaseClient'

import Login from './components/Login'
import ChatAssistant from './components/ChatAssistant'
import AddExpenseForm from './components/AddExpenseForm'
import ExpenseList from './components/ExpenseList'
import MonthlySummary from './components/MonthlySummary'

function App() {
  const [session, setSession] = useState(null)
  const [subscriptionStatus, setSubscriptionStatus] = useState('free')
  const [showPaywall, setShowPaywall] = useState(false)

  const [categories, setCategories] = useState([])
  const [expenses, setExpenses] = useState([])

  const [amount, setAmount] = useState('')
  const [merchant, setMerchant] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('card')
  const [spentAtLocal, setSpentAtLocal] = useState(getNowLocalDateTime())
  const [status, setStatus] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // BASIC
  const [showMoreOptions, setShowMoreOptions] = useState(true)
  const [isTaxDeductible, setIsTaxDeductible] = useState(false)
  const [notes, setNotes] = useState('')

  // PRO
  const isProMode = subscriptionStatus === 'pro'
  const [isReimbursable, setIsReimbursable] = useState(false)
  const [employerOrClient, setEmployerOrClient] = useState('')
  const [tagsText, setTagsText] = useState('')

  // NEW: Budget tracking state
  const [budgets, setBudgets] = useState({}) // { categoryId: { limit: number, spent: number } }
  const [showBudgetPanel, setShowBudgetPanel] = useState(false)

  // NEW: AI Insights state
  const [aiInsights, setAiInsights] = useState(null) // { prediction, recurring, alerts }

  // Custom categories
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')

  // Receipt
  const [receiptFile, setReceiptFile] = useState(null)
  const [receiptUrls, setReceiptUrls] = useState({})
  const [isProcessingReceipt, setIsProcessingReceipt] = useState(false)

  // Archive
  const [showArchived, setShowArchived] = useState(false)

  // Search
  const [search, setSearch] = useState('')

  // Undo banner
  const [undoBanner, setUndoBanner] = useState(null)
  const undoTimerRef = useRef(null)

  // Merchant-memory map
  const merchantMemoryRef = useRef(new Map())

  // Learned indicator state
  const [categoryLearnedSource, setCategoryLearnedSource] = useState(null)

  const showUndoBanner = useCallback((banner, ms = 12000) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    setUndoBanner(banner)
    undoTimerRef.current = setTimeout(() => {
      setUndoBanner(null)
      undoTimerRef.current = null
    }, ms)
  }, [])

  const clearUndoBanner = useCallback(() => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    undoTimerRef.current = null
    setUndoBanner(null)
  }, [])

  const CATEGORY_RULES = useMemo(() => {
    return {
      Gas: ['chevron', 'shell', '76', 'mobile', 'exxon', 'bp', 'arco', 'valero', 'costco gas'],
      Food: ['starbucks', 'mcdonald', 'chipotle', 'taco', 'pizza', 'restaurant', 'cafe', 'coffee', 'netflix', 'spotify'],
      Home: ['home depot', 'lowes', "lowe's", 'ikea', 'target', 'walmart', 'amazon'],
      Personal: ['cvs', 'walgreens', 'ulta', 'sephora', 'barber', 'salon', 'gym'],
      Transportation: ['uber', 'lyft', 'taxi', 'bus', 'train', 'parking'],
      Other: []
    }
  }, [])

  // session
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // Load subscription status
  useEffect(() => {
    if (!session?.user?.id) return

    const loadSubscription = async () => {
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('subscription_status')
        .eq('user_id', session.user.id)
        .single()

      if (!error && data) {
        setSubscriptionStatus(data.subscription_status === 'pro' ? 'pro' : 'free')
      } else {
        await supabase.from('user_subscriptions').insert({
          user_id: session.user.id,
          subscription_status: 'free'
        })
        setSubscriptionStatus('free')
      }
    }

    loadSubscription()
  }, [session])

  // Reset pro features when not pro
  useEffect(() => {
    if (!isProMode) {
      setIsReimbursable(false)
      setEmployerOrClient('')
      setTagsText('')
    }
  }, [isProMode])

  // Merchant key normalization
  const normalizeMerchantKey = useCallback((s) => {
    let t = String(s || '').toLowerCase().trim()
    t = t.replace(/[\s\-_]+/g, ' ')
    t = t.replace(/\s*#\s*\d+\s*$/g, '')
    t = t.replace(/\s*(store|unit|location)\s*\d+\s*$/g, '')
    t = t.replace(/[^a-z0-9 &]/g, '')
    t = t.replace(/\s+/g, ' ').trim()
    return t
  }, [])

  const buildMerchantMemory = useCallback((list) => {
    const m = new Map()
    for (const e of list || []) {
      if (!e?.merchant || !e?.category_id) continue
      const key = normalizeMerchantKey(e.merchant)
      if (!key) continue

      if (!m.has(key)) m.set(key, new Map())
      const inner = m.get(key)
      inner.set(e.category_id, (inner.get(e.category_id) || 0) + 1)
    }

    const best = new Map()
    for (const [merchantKey, countsByCategory] of m.entries()) {
      let topCategoryId = null
      let topCount = 0
      for (const [cid, cnt] of countsByCategory.entries()) {
        if (cnt > topCount) {
          topCount = cnt
          topCategoryId = cid
        }
      }
      if (topCategoryId) best.set(merchantKey, { categoryId: topCategoryId, count: topCount })
    }

    merchantMemoryRef.current = best
  }, [normalizeMerchantKey])

  const suggestCategoryForMerchant = useCallback((merchantText) => {
    const key = normalizeMerchantKey(merchantText)
    if (!key) {
      setCategoryLearnedSource(null)
      return null
    }

    const learned = merchantMemoryRef.current.get(key)
    if (learned?.categoryId) {
      const exists = categories.some(c => c.id === learned.categoryId)
      if (exists) {
        setCategoryLearnedSource('learned')
        return learned.categoryId
      }
    }

    const ruleResult = pickCategoryIdFromMerchant(merchantText, categories, CATEGORY_RULES)
    if (ruleResult) {
      setCategoryLearnedSource('rule')
    } else {
      setCategoryLearnedSource(null)
    }
    return ruleResult
  }, [normalizeMerchantKey, categories, CATEGORY_RULES])

  // Auto-select category when merchant changes
  useEffect(() => {
    if (!session?.user?.id) return
    if (!merchant || !categories.length) {
      setCategoryLearnedSource(null)
      return
    }

    const suggestion = suggestCategoryForMerchant(merchant)
    if (suggestion && suggestion !== categoryId) {
      setCategoryId(suggestion)
    }
  }, [merchant, categories, session, suggestCategoryForMerchant, categoryId])

  // NEW FEATURE 5: Enhanced Receipt OCR with tip/tax breakdown
  const processReceiptWithOCR = useCallback(async (file) => {
    if (!file) return

    setIsProcessingReceipt(true)
    setStatus('🤖 Reading receipt with AI...')

    try {
      const base64 = await fileToBase64(file)

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
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Extract DETAILED expense data from this receipt. Return ONLY valid JSON (no markdown):
{
  "amount": <total after tax/tip as number>,
  "merchant": <store name string>,
  "date": <YYYY-MM-DD or null>,
  "category_hint": <"Gas"|"Food"|"Home"|"Personal"|"Transportation"|"Other"|null>,
  "subtotal": <amount before tax as number or null>,
  "tax": <tax amount as number or null>,
  "tip": <tip amount as number or null>,
  "tip_percent": <tip percentage as number or null>
}

Rules:
- amount: TOTAL paid (subtotal + tax + tip)
- Extract subtotal, tax, tip separately if visible
- Calculate tip_percent if tip and subtotal available
- merchant: clean name (e.g. "Starbucks")
- date: YYYY-MM-DD format
- Return ONLY JSON, no explanations`
                },
                {
                  type: 'image_url',
                  image_url: { url: base64 }
                }
              ]
            }
          ],
          max_tokens: 400,
          temperature: 0
        })
      })

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`)
      }

      const data = await response.json()
      const content = data?.choices?.[0]?.message?.content?.trim()

      if (!content) {
        throw new Error('No response from AI')
      }

      let jsonText = content
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      }

      const parsed = JSON.parse(jsonText)

      if (parsed.amount) {
        setAmount(String(parsed.amount))
      }

      if (parsed.merchant) {
        setMerchant(parsed.merchant)
        const auto = suggestCategoryForMerchant(parsed.merchant)
        if (auto) {
          setCategoryId(auto)
        } else if (parsed.category_hint) {
          const hintCat = categories.find(c => 
            c.name.toLowerCase() === parsed.category_hint.toLowerCase()
          )
          if (hintCat) setCategoryId(hintCat.id)
        }
      }

      if (parsed.date) {
        try {
          const d = new Date(parsed.date)
          if (!isNaN(d.getTime())) {
            const pad = (n) => String(n).padStart(2, '0')
            const yyyy = d.getFullYear()
            const mm = pad(d.getMonth() + 1)
            const dd = pad(d.getDate())
            const hh = pad(d.getHours())
            const min = pad(d.getMinutes())
            setSpentAtLocal(`${yyyy}-${mm}-${dd}T${hh}:${min}`)
          }
        } catch {}
      }

      // Build enhanced notes with breakdown
      let enhancedNotes = ''
      if (parsed.subtotal) enhancedNotes += `Subtotal: $${parsed.subtotal.toFixed(2)}\n`
      if (parsed.tax) enhancedNotes += `Tax: $${parsed.tax.toFixed(2)}\n`
      if (parsed.tip) {
        enhancedNotes += `Tip: $${parsed.tip.toFixed(2)}`
        if (parsed.tip_percent) enhancedNotes += ` (${parsed.tip_percent.toFixed(1)}%)`
      }
      if (enhancedNotes) setNotes(enhancedNotes.trim())

      setStatus('✅ Receipt analyzed! (Subtotal, tax, tip extracted)')
      setCategoryLearnedSource('ai')

      setTimeout(() => {
        if (status.includes('Receipt analyzed')) setStatus('')
      }, 4000)

    } catch (err) {
      console.error('OCR error:', err)
      setStatus(`⚠️ OCR failed: ${err.message}`)
    } finally {
      setIsProcessingReceipt(false)
    }
  }, [suggestCategoryForMerchant, categories, status])

  // Trigger OCR when receipt file changes
  useEffect(() => {
    if (receiptFile && !isProcessingReceipt) {
      processReceiptWithOCR(receiptFile)
    }
  }, [receiptFile, isProcessingReceipt, processReceiptWithOCR])

  const loadCategories = useCallback(async () => {
    if (!session) return
    
    const { data, error } = await supabase
      .from('categories')
      .select('id,name,is_custom,user_id')
      .order('name')

    if (!error && data) {
      const filtered = data.filter(c => c.user_id === null || c.user_id === session.user.id)
      setCategories(filtered)
      if (!categoryId && filtered[0]) setCategoryId(filtered[0].id)
    }
  }, [session, categoryId])

  useEffect(() => {
    if (!session) return
    loadCategories()
  }, [session, loadCategories])

  const ensureReceiptThumb = async (expense) => {
    if (!expense?.id || !expense?.receipt_image_url) return
    if (receiptUrls[expense.id]) return

    const { data, error } = await supabase.storage
      .from('receipts')
      .createSignedUrl(expense.receipt_image_url, 60 * 10)

    if (!error && data?.signedUrl) {
      setReceiptUrls(prev => ({ ...prev, [expense.id]: data.signedUrl }))
    }
  }

  // NEW FEATURE 2 & 3 & 4: Calculate budgets, predictions, recurring expenses
  const calculateAIInsights = useCallback((expensesList, categoriesList) => {
    if (!isProMode || !expensesList.length) {
      setAiInsights(null)
      return
    }

    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    
    // Current month expenses
    const thisMonth = expensesList.filter(e => {
      const d = new Date(e.spent_at)
      const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      return m === currentMonth && !e.archived
    })

    // Last month expenses
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`
    const lastMonthExpenses = expensesList.filter(e => {
      const d = new Date(e.spent_at)
      const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      return m === lastMonth && !e.archived
    })

    // FEATURE 3: Spending prediction
    const thisMonthTotal = thisMonth.reduce((sum, e) => sum + Number(e.amount), 0)
    const lastMonthTotal = lastMonthExpenses.reduce((sum, e) => sum + Number(e.amount), 0)
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const daysPassed = now.getDate()
    const daysRemaining = daysInMonth - daysPassed
    const dailyAvg = daysPassed > 0 ? thisMonthTotal / daysPassed : 0
    const predictedTotal = thisMonthTotal + (dailyAvg * daysRemaining)

    // FEATURE 4: Recurring expense detection
    const merchantFrequency = {}
    expensesList.slice(0, 90).forEach(e => { // Last 90 expenses
      const key = normalizeMerchantKey(e.merchant)
      if (!key) return
      if (!merchantFrequency[key]) {
        merchantFrequency[key] = { merchant: e.merchant, amounts: [], dates: [] }
      }
      merchantFrequency[key].amounts.push(Number(e.amount))
      merchantFrequency[key].dates.push(new Date(e.spent_at))
    })

    const recurring = []
    Object.entries(merchantFrequency).forEach(([key, data]) => {
      if (data.amounts.length >= 2) {
        const avgAmount = data.amounts.reduce((a, b) => a + b, 0) / data.amounts.length
        const amountVariance = Math.max(...data.amounts) - Math.min(...data.amounts)
        const isConsistentAmount = amountVariance < avgAmount * 0.1 // Less than 10% variance

        if (isConsistentAmount && data.dates.length >= 2) {
          // Check if dates are roughly monthly
          const sortedDates = data.dates.sort((a, b) => b - a)
          const daysBetween = []
          for (let i = 0; i < sortedDates.length - 1; i++) {
            const diff = (sortedDates[i] - sortedDates[i + 1]) / (1000 * 60 * 60 * 24)
            daysBetween.push(diff)
          }
          const avgDaysBetween = daysBetween.reduce((a, b) => a + b, 0) / daysBetween.length

          if (avgDaysBetween >= 25 && avgDaysBetween <= 35) { // Roughly monthly
            recurring.push({
              merchant: data.merchant,
              amount: avgAmount,
              frequency: 'monthly',
              lastDate: sortedDates[0]
            })
          }
        }
      }
    })

    // FEATURE 2: Budget tracking - calculate spent per category
    const categorySpending = {}
    thisMonth.forEach(e => {
      const catId = e.category_id
      if (!categorySpending[catId]) categorySpending[catId] = 0
      categorySpending[catId] += Number(e.amount)
    })

    setAiInsights({
      prediction: {
        currentTotal: thisMonthTotal,
        predictedTotal,
        lastMonthTotal,
        daysRemaining,
        dailyAvg
      },
      recurring,
      categorySpending
    })

  }, [isProMode, normalizeMerchantKey])

  const loadExpenses = useCallback(async () => {
    if (!session?.user?.id) return

    setStatus('')

    let q = supabase
      .from('expenses')
      .select('id, amount, merchant, payment_method, spent_at, created_at, category_id, receipt_image_url, is_tax_deductible, is_reimbursable, employer_or_client, notes, archived, tags, location')
      .order('spent_at', { ascending: false })
      .order('created_at', { ascending: false })
      .eq('archived', showArchived)

    const s = search.trim()
    if (s) {
      q = q.or(`merchant.ilike.%${escapeIlike(s)}%,notes.ilike.%${escapeIlike(s)}%`)
    }

    const { data, error } = await q

    if (error || !data) {
      setStatus(error?.message || 'Could not load expenses')
      return
    }

    setExpenses(data)
    buildMerchantMemory(data)
    calculateAIInsights(data, categories)

    const withReceipts = data.filter(x => x.receipt_image_url)
    for (const e of withReceipts) {
      await ensureReceiptThumb(e)
    }
  }, [session, showArchived, search, buildMerchantMemory, calculateAIInsights, categories])

  useEffect(() => {
    if (!session) return
    loadExpenses()
  }, [session, showArchived, loadExpenses])

  // Recalculate insights when expenses or categories change
  useEffect(() => {
    if (expenses.length && categories.length) {
      calculateAIInsights(expenses, categories)
    }
  }, [expenses, categories, calculateAIInsights])

  const login = async (email, password) => {
    setStatus('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setStatus(error.message)
  }

  const logout = async () => {
    await supabase.auth.signOut()
    setStatus('Logged out')
  }

  const addCustomCategory = async () => {
    setStatus('')
    const name = newCategoryName.trim()
    if (!name) {
      setStatus('Category name required')
      return
    }

    const { error } = await supabase.from('categories').insert({
      user_id: session.user.id,
      name,
      is_custom: true
    })

    if (error) {
      setStatus(error.message)
      return
    }

    setNewCategoryName('')
    setShowAddCategory(false)
    setStatus('Category added')
    await loadCategories()
  }

  const addExpense = async () => {
    setStatus('')
    setIsSaving(true)
    setSaveSuccess(false)

    const amt = parseFloat(amount)

    if (!session?.user?.id) {
      setStatus('Not logged in')
      setIsSaving(false)
      return
    }

    if (!amt || !merchant || !categoryId) {
      setStatus('Missing fields')
      setIsSaving(false)
      return
    }

    const spentAtIso = new Date(spentAtLocal).toISOString()
    const tags = isProMode ? parseTags(tagsText) : null
    const location = await getLocationString()

    const { data: inserted, error: insertError } = await supabase
      .from('expenses')
      .insert({
        user_id: session.user.id,
        amount: amt,
        merchant,
        category_id: categoryId,
        payment_method: paymentMethod,
        spent_at: spentAtIso,
        raw_input: null,
        is_tax_deductible: isTaxDeductible,
        is_reimbursable: isProMode ? isReimbursable : false,
        employer_or_client: isProMode && isReimbursable ? (employerOrClient || null) : null,
        notes: notes?.trim() ? notes.trim() : null,
        archived: false,
        tags,
        location
      })
      .select('id')
      .single()

    if (insertError) {
      setStatus(insertError.message)
      setIsSaving(false)
      return
    }

    const expenseId = inserted?.id

    if (receiptFile && expenseId) {
      setStatus('Uploading receipt...')

      const safeName = sanitizeFilename(receiptFile.name || 'receipt.jpg')
      const path = `${session.user.id}/${expenseId}/${Date.now()}-${safeName}`

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(path, receiptFile, { cacheControl: '3600', upsert: false })

      if (uploadError) {
        setStatus(`Receipt upload failed: ${uploadError.message}`)
        setIsSaving(false)
        await loadExpenses()
        return
      }

      const { error: updateError } = await supabase
        .from('expenses')
        .update({ receipt_image_url: path })
        .eq('id', expenseId)

      if (updateError) {
        setStatus(`Receipt uploaded, but link failed: ${updateError.message}`)
        setIsSaving(false)
        await loadExpenses()
        return
      }
    }

    setAmount('')
    setMerchant('')
    setSpentAtLocal(getNowLocalDateTime())
    setReceiptFile(null)
    setIsTaxDeductible(false)
    setNotes('')
    setIsReimbursable(false)
    setEmployerOrClient('')
    setTagsText('')
    setCategoryLearnedSource(null)

    setIsSaving(false)
    setSaveSuccess(true)
    setStatus('Saved')

    setTimeout(() => setSaveSuccess(false), 2000)

    await loadExpenses()
  }

  const updateExpense = async (updatedExpense) => {
    setStatus('')
    
    const { error } = await supabase
      .from('expenses')
      .update({
        amount: updatedExpense.amount,
        merchant: updatedExpense.merchant,
        category_id: updatedExpense.category_id,
        payment_method: updatedExpense.payment_method,
        spent_at: updatedExpense.spent_at,
        is_tax_deductible: updatedExpense.is_tax_deductible,
        is_reimbursable: updatedExpense.is_reimbursable,
        employer_or_client: updatedExpense.employer_or_client,
        notes: updatedExpense.notes,
        tags: updatedExpense.tags
      })
      .eq('id', updatedExpense.id)

    if (error) {
      setStatus(`Update failed: ${error.message}`)
      return
    }

    setStatus('✓ Updated')
    setTimeout(() => setStatus(''), 2000)
    await loadExpenses()
  }

  const setArchivedForExpense = async (expenseId, archived) => {
    setStatus('')
    const { error } = await supabase
      .from('expenses')
      .update({ archived })
      .eq('id', expenseId)

    if (error) {
      setStatus(error.message)
      return false
    }

    await loadExpenses()
    return true
  }

  const archiveWithUndo = async (expenseId) => {
    clearUndoBanner()

    const ok = await setArchivedForExpense(expenseId, true)
    if (!ok) return

    showUndoBanner({
      message: 'Expense archived.',
      actionLabel: 'Undo',
      onAction: async () => {
        clearUndoBanner()
        await setArchivedForExpense(expenseId, false)
        showUndoBanner({ message: 'Restored.' }, 2500)
      }
    })
  }

  const deleteExpense = async (expenseId) => {
    setStatus('')
    const ok = window.confirm('Delete this expense permanently?')
    if (!ok) return

    const { error } = await supabase.rpc('delete_expense', { p_id: expenseId })
    if (error) {
      setStatus(error.message)
      return
    }

    await loadExpenses()
  }

  const openReceipt = async (expense) => {
    if (!expense?.receipt_image_url) return
    setStatus('Opening receipt...')

    const { data, error } = await supabase.storage
      .from('receipts')
      .createSignedUrl(expense.receipt_image_url, 60 * 10)

    if (error || !data?.signedUrl) {
      setStatus(error?.message || 'Could not open receipt')
      return
    }

    setStatus('')
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  const exportCsv = () => {
    if (!expenses || expenses.length === 0) {
      setStatus('No expenses to export')
      return
    }

    const categoryName = (id) => {
      const c = categories.find(x => x.id === id)
      return c ? c.name : '—'
    }

    const header = [
      'date_time',
      'amount',
      'paid_to',
      'category',
      'payment_method',
      'tax_deductible',
      'reimbursable',
      'employer_or_client',
      'notes',
      'tags',
      'location',
      'receipt_attached',
      'archived'
    ]

    const rows = expenses.map(e => {
      const row = [
        new Date(e.spent_at).toISOString(),
        Number(e.amount).toFixed(2),
        e.merchant || '',
        categoryName(e.category_id),
        e.payment_method || '',
        e.is_tax_deductible ? 'yes' : 'no',
        e.is_reimbursable ? 'yes' : 'no',
        e.employer_or_client || '',
        e.notes || '',
        (e.tags || []).join('|'),
        e.location || '',
        e.receipt_image_url ? 'yes' : 'no',
        e.archived ? 'yes' : 'no'
      ]
      return row.map(csvEscape).join(',')
    })

    const csv = [header.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = `spender-tracker-${showArchived ? 'archived' : 'active'}-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)

    URL.revokeObjectURL(url)
    setStatus('CSV exported')
  }

  const runSearch = async () => {
    await loadExpenses()
  }

  const clearSearch = async () => {
    setSearch('')
    setTimeout(() => loadExpenses(), 0)
  }

  const upgradeToPro = () => {
    setShowPaywall(true)
  }

  const handleStripeCheckout = async () => {
    setStatus('Stripe checkout not wired yet (no fake Pro upgrade).')
    setShowPaywall(false)
    setSubscriptionStatus('free')
  }

  // NEW FEATURE 1: Handle AI commands with natural language date parsing
  const handleAICommand = (command) => {
    if (command.action === 'add_expense') {
      if (command.data.amount) setAmount(String(command.data.amount))
      if (command.data.merchant) setMerchant(command.data.merchant)
      
      // NEW: Natural language date parsing
      if (command.data.dateHint) {
        const parsedDate = parseNaturalDate(command.data.dateHint)
        if (parsedDate) {
          setSpentAtLocal(parsedDate)
          setStatus(`✨ AI filled form with date: ${command.data.dateHint}`)
        }
      } else {
        setStatus('✨ AI filled the form—review and save')
      }
    }

    if (command.action === 'search') {
      setSearch(command.data.query)
      setTimeout(() => loadExpenses(), 100)
    }

    if (command.action === 'export') {
      exportCsv()
    }
  }

  if (!session) {
    return <Login onLogin={login} status={status} />
  }

  const customCount = categories.filter(c => c.is_custom && c.user_id === session.user.id).length
  const canAddCategory = isProMode || customCount < 3

  return (
    <div style={{ padding: 40, maxWidth: 820, margin: '0 auto' }}>
      {/* Paywall Modal */}
      {showPaywall ? (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#fff',
            padding: 40,
            borderRadius: 16,
            maxWidth: 500,
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
          }}>
            <h2 style={{ marginTop: 0 }}>Upgrade to Pro</h2>
            <p style={{ fontSize: 18, marginBottom: 20 }}>Unlock advanced AI features for $5/month:</p>
            <ul style={{ lineHeight: 2, marginBottom: 30 }}>
              <li>✨ Enhanced receipt OCR (tip/tax breakdown)</li>
              <li>📊 Spending predictions & forecasts</li>
              <li>🔄 Recurring expense detection</li>
              <li>💰 Budget tracking & alerts</li>
              <li>🏷️ Unlimited custom categories</li>
              <li>📁 Unlimited receipt storage</li>
              <li>🤖 Natural language date parsing</li>
            </ul>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleStripeCheckout} style={{ flex: 1, padding: '12px 20px', fontSize: 16, backgroundColor: '#4caf50', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                Continue to Payment
              </button>
              <button onClick={() => setShowPaywall(false)} style={{ padding: '12px 20px', fontSize: 16 }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 30 }}>
        <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700 }}>💰 Spender Tracker</h1>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {isProMode ? (
            <span style={{ 
              padding: '6px 12px', 
              backgroundColor: '#4caf50', 
              color: '#fff', 
              borderRadius: 999, 
              fontSize: 14, 
              fontWeight: 600 
            }}>
              PRO
            </span>
          ) : (
            <button onClick={upgradeToPro} style={{ 
              padding: '6px 12px', 
              backgroundColor: '#ff9800', 
              color: '#fff', 
              border: 'none', 
              borderRadius: 999, 
              fontSize: 14, 
              fontWeight: 600,
              cursor: 'pointer'
            }}>
              Upgrade to Pro
            </button>
          )}
          <button onClick={logout}>Logout</button>
        </div>
      </div>

      {undoBanner ? (
        <div
          style={{
            marginBottom: 12,
            padding: '10px 12px',
            border: '1px solid #ddd',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            justifyContent: 'space-between'
          }}
        >
          <div style={{ fontWeight: 600 }}>{undoBanner.message}</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {undoBanner.onAction ? (
              <button onClick={undoBanner.onAction}>{undoBanner.actionLabel || 'Undo'}</button>
            ) : null}
            <button onClick={clearUndoBanner} style={{ opacity: 0.7 }}>
              ✕
            </button>
          </div>
        </div>
      ) : null}

      {/* NEW: AI Insights Panel (Pro only) */}
      {isProMode && aiInsights ? (
        <div style={{
          marginBottom: 24,
          padding: 20,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: 16,
          color: 'white',
          boxShadow: '0 8px 24px rgba(102, 126, 234, 0.3)'
        }}>
          <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 20 }}>🤖 AI Financial Insights</h3>
          
          {/* Spending Prediction */}
          <div style={{ marginBottom: 16, padding: 14, background: 'rgba(255,255,255,0.15)', borderRadius: 10 }}>
            <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 6 }}>📈 This Month Forecast</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>${aiInsights.prediction.predictedTotal.toFixed(0)}</div>
            <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>
              Current: ${aiInsights.prediction.currentTotal.toFixed(0)} • 
              {aiInsights.prediction.daysRemaining} days left • 
              ${aiInsights.prediction.dailyAvg.toFixed(0)}/day avg
            </div>
            {aiInsights.prediction.lastMonthTotal > 0 && (
              <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>
                Last month: ${aiInsights.prediction.lastMonthTotal.toFixed(0)}
                {aiInsights.prediction.predictedTotal > aiInsights.prediction.lastMonthTotal ? 
                  ` (↑ ${((aiInsights.prediction.predictedTotal / aiInsights.prediction.lastMonthTotal - 1) * 100).toFixed(0)}%)` :
                  ` (↓ ${((1 - aiInsights.prediction.predictedTotal / aiInsights.prediction.lastMonthTotal) * 100).toFixed(0)}%)`
                }
              </div>
            )}
          </div>

          {/* Recurring Expenses */}
          {aiInsights.recurring.length > 0 && (
            <div style={{ padding: 14, background: 'rgba(255,255,255,0.15)', borderRadius: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>🔄 Recurring Subscriptions Detected:</div>
              {aiInsights.recurring.slice(0, 3).map((r, i) => (
                <div key={i} style={{ fontSize: 13, opacity: 0.9, marginBottom: 4 }}>
                  • {r.merchant}: ${r.amount.toFixed(2)}/{r.frequency}
                </div>
              ))}
              {aiInsights.recurring.length > 3 && (
                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
                  +{aiInsights.recurring.length - 3} more recurring expenses
                </div>
              )}
            </div>
          )}
        </div>
      ) : null}

      {/* AI-FIRST INTERFACE */}
      <ChatAssistant
        expenses={expenses}
        categories={categories}
        isProMode={isProMode}
        onUpgradeToPro={upgradeToPro}
        onAICommand={handleAICommand}
      />

      {/* MANUAL FORM */}
      <AddExpenseForm
        amount={amount} setAmount={setAmount}
        merchant={merchant} setMerchant={setMerchant}
        spentAtLocal={spentAtLocal} setSpentAtLocal={setSpentAtLocal}
        paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod}
        categoryId={categoryId} setCategoryId={setCategoryId}
        categories={categories}

        showMoreOptions={showMoreOptions} setShowMoreOptions={setShowMoreOptions}
        isTaxDeductible={isTaxDeductible} setIsTaxDeductible={setIsTaxDeductible}
        notes={notes} setNotes={setNotes}

        isProMode={isProMode}
        isReimbursable={isReimbursable} setIsReimbursable={setIsReimbursable}
        employerOrClient={employerOrClient} setEmployerOrClient={setEmployerOrClient}
        tagsText={tagsText} setTagsText={setTagsText}

        showAddCategory={showAddCategory} setShowAddCategory={setShowAddCategory}
        newCategoryName={newCategoryName} setNewCategoryName={setNewCategoryName}
        customCount={customCount}
        canAddCategory={canAddCategory}
        onAddCustomCategory={addCustomCategory}
        onUpgradeToPro={upgradeToPro}

        receiptFile={receiptFile} setReceiptFile={setReceiptFile}

        onSave={addExpense}
        isSaving={isSaving}
        saveSuccess={saveSuccess}

        categoryLearnedSource={categoryLearnedSource}
      />

      <p>{status}</p>

      <hr style={{ margin: '30px 0' }} />

      {/* EXPENSE LIST */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>{showArchived ? 'Archived expenses' : 'Recent expenses'}</h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={showArchived}
              onChange={e => setShowArchived(e.target.checked)}
            />
            Show archived
          </label>
          <button onClick={loadExpenses}>Refresh</button>
          <button onClick={exportCsv}>Export CSV</button>
        </div>
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search paid to or notes..."
          style={{ width: 260 }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') runSearch()
          }}
        />
        <button onClick={runSearch}>Search</button>
        <button onClick={clearSearch}>Clear</button>
      </div>

      <ExpenseList
        expenses={expenses}
        categories={categories}
        showArchived={showArchived}
        receiptUrls={receiptUrls}
        onArchive={archiveWithUndo}
        onUnarchive={(id) => setArchivedForExpense(id, false)}
        onDelete={deleteExpense}
        onOpenReceipt={openReceipt}
        onUpdateExpense={updateExpense}
      />

      <MonthlySummary 
        expenses={expenses} 
        categories={categories} 
        isProMode={isProMode}
        onUpgradeToPro={upgradeToPro}
      />
    </div>
  )
}

/* NEW FEATURE 1: Natural language date parser */
function parseNaturalDate(text) {
  const lower = text.toLowerCase().trim()
  const now = new Date()
  
  // Helper to format date
  const formatDate = (d) => {
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  // Today
  if (lower.includes('today')) return formatDate(now)

  // Yesterday
  if (lower.includes('yesterday')) {
    const d = new Date(now)
    d.setDate(d.getDate() - 1)
    return formatDate(d)
  }

  // X days ago
  const daysAgoMatch = lower.match(/(\d+)\s*days?\s*ago/)
  if (daysAgoMatch) {
    const days = parseInt(daysAgoMatch[1])
    const d = new Date(now)
    d.setDate(d.getDate() - days)
    return formatDate(d)
  }

  // Last week
  if (lower.includes('last week')) {
    const d = new Date(now)
    d.setDate(d.getDate() - 7)
    return formatDate(d)
  }

  // Last month
  if (lower.includes('last month')) {
    const d = new Date(now)
    d.setMonth(d.getMonth() - 1)
    return formatDate(d)
  }

  // Specific day: "last tuesday", "monday", etc.
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  for (let i = 0; i < dayNames.length; i++) {
    if (lower.includes(dayNames[i])) {
      const targetDay = i
      const currentDay = now.getDay()
      let daysBack = currentDay - targetDay
      if (daysBack <= 0) daysBack += 7 // Last occurrence
      if (lower.includes('last')) daysBack += 7
      
      const d = new Date(now)
      d.setDate(d.getDate() - daysBack)
      return formatDate(d)
    }
  }

  return null // Could not parse
}

/* helpers */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function csvEscape(value) {
  const s = String(value ?? '')
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function escapeIlike(s) {
  return String(s || '').replace(/[%_]/g, (m) => '\\' + m)
}

function pickCategoryIdFromMerchant(merchant, categories, rules) {
  const m = (merchant || '').toLowerCase().trim()
  if (!m) return null

  for (const [catName, keywords] of Object.entries(rules)) {
    if (!keywords || keywords.length === 0) continue
    for (const kw of keywords) {
      const k = (kw || '').toLowerCase().trim()
      if (!k) continue
      if (m.includes(k)) {
        const cat = categories.find(c => c.name.toLowerCase() === catName.toLowerCase())
        return cat ? cat.id : null
      }
    }
  }
  return null
}

function sanitizeFilename(name) {
  return String(name || '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 120)
}

function parseTags(tagsText) {
  const parts = String(tagsText || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  const seen = new Set()
  const out = []
  for (const p of parts) {
    const key = p.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(p)
    if (out.length >= 10) break
  }
  return out.length ? out : null
}

function getNowLocalDateTime() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const yyyy = d.getFullYear()
  const mm = pad(d.getMonth() + 1)
  const dd = pad(d.getDate())
  const hh = pad(d.getHours())
  const min = pad(d.getMinutes())
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`
}

async function getLocationString() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null)

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`)
          const json = await res.json()
          const city = json?.address?.city || json?.address?.town || json?.address?.village || ''
          const state = json?.address?.state || ''
          resolve([city, state].filter(Boolean).join(', ') || null)
        } catch {
          resolve(null)
        }
      },
      () => resolve(null),
      { timeout: 5000 }
    )
  })
}

export default App
