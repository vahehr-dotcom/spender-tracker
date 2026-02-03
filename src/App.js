import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { supabase } from './supabaseClient'

import Login from './components/Login'
import ChatAssistant from './components/ChatAssistant'
import AddExpenseForm from './components/AddExpenseForm'
import ExpenseList from './components/ExpenseList'
import MonthlySummary from './components/MonthlySummary'
import FileImport from './components/FileImport'
import ImportPreview from './components/ImportPreview'
import AnalyticsDashboard from './components/AnalyticsDashboard'

import ProactiveEngine from './lib/ProactiveEngine'
import PatternAnalyzer from './lib/PatternAnalyzer'
import PredictiveEngine from './lib/PredictiveEngine'

// Helper: current local datetime string for default spentAt
function getNowLocalDateTime() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60000
  const local = new Date(now.getTime() - offset)
  return local.toISOString().slice(0, 16)
}

function App() {
  // Auth & subscription state
  const [session, setSession] = useState(null)
  const [subscriptionStatus, setSubscriptionStatus] = useState('free') // 'free' or 'pro'
  const [testMode, setTestMode] = useState(false) // Admin testing toggle
  const [showPaywall, setShowPaywall] = useState(false)

  // User profile & role
  const [userRole, setUserRole] = useState(null)
  const [userName, setUserName] = useState('')
  const [userTitle, setUserTitle] = useState('')

  // UI toggles for admin
  const [showLoginHistory, setShowLoginHistory] = useState(false)
  const [showAnalytics, setShowAnalytics] = useState(false)

  // Categories
  const [categories, setCategories] = useState([])

  // Expenses
  const [expenses, setExpenses] = useState([])
  const [allExpenses, setAllExpenses] = useState([])

  // Add expense form
  const [amount, setAmount] = useState('')
  const [merchant, setMerchant] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('card')
  const [spentAtLocal, setSpentAtLocal] = useState(getNowLocalDateTime())
  const [status, setStatus] = useState('cleared')
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // More options
  const [showMoreOptions, setShowMoreOptions] = useState(false)
  const [isTaxDeductible, setIsTaxDeductible] = useState(false)
  const [notes, setNotes] = useState('')
  const [isReimbursable, setIsReimbursable] = useState(false)
  const [employerOrClient, setEmployerOrClient] = useState('')
  const [tagsText, setTagsText] = useState('')

  // Budgets
  const [budgets, setBudgets] = useState([])
  const [showBudgetPanel, setShowBudgetPanel] = useState(false)

  // AI insights (Pro feature)
  const [aiInsights, setAiInsights] = useState(null)

  // Receipt upload
  const [receiptFile, setReceiptFile] = useState(null)
  const [receiptUrls, setReceiptUrls] = useState([])
  const [isProcessingReceipt, setIsProcessingReceipt] = useState(false)

  // Archive & search
  const [showArchived, setShowArchived] = useState(false)
  const [search, setSearch] = useState('')

  // Undo banner (for archive undo)
  const [undoBanner, setUndoBanner] = useState(null)

  // Import
  const [showImport, setShowImport] = useState(false)
  const [importedTransactions, setImportedTransactions] = useState([])

  // Notifications (Pro feature)
  const [notifications, setNotifications] = useState([])

  // Session tracking
  const sessionIdRef = useRef(null)
  const lastActivityRef = useRef(Date.now())
  const pageStartRef = useRef(Date.now())

  // Merchant memory for category suggestions
  const merchantMemoryRef = useRef(new Map())

  // Derive Pro mode flag
  const isProMode = !testMode && subscriptionStatus === 'pro'

  // Derive admin flag
  const isAdmin = userRole === 'admin'

  // ---------------------------------------------------------------------------
  // Session & auth setup
  // ---------------------------------------------------------------------------
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Track session start/continue and last_activity
  useEffect(() => {
    if (!session?.user) return

    const userId = session.user.id

    async function startOrContinueSession() {
      try {
        // Check for an active session in last 30 minutes
        const { data: existing } = await supabase
          .from('user_sessions')
          .select('id')
          .eq('user_id', userId)
          .is('session_end', null)
          .order('session_start', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (existing) {
          sessionIdRef.current = existing.id
          console.log('[App] Continuing session:', existing.id)
        } else {
          // Create new session
          const { data: newSession } = await supabase
            .from('user_sessions')
            .insert({
              user_id: userId,
              session_start: new Date().toISOString(),
            })
            .select()
            .single()

          if (newSession) {
            sessionIdRef.current = newSession.id
            console.log('[App] New session started:', newSession.id)
          }
        }
      } catch (err) {
        console.error('[App] startOrContinueSession error:', err)
      }
    }

    startOrContinueSession()

    // Track last_activity every 30s
    const activityInterval = setInterval(async () => {
      if (sessionIdRef.current) {
        lastActivityRef.current = Date.now()
        await supabase
          .from('user_sessions')
          .update({ last_activity: new Date().toISOString() })
          .eq('id', sessionIdRef.current)
      }
    }, 30000)

    // On unload, finalize session
    const handleUnload = async () => {
      if (sessionIdRef.current) {
        const start = pageStartRef.current
        const end = Date.now()
        const duration = Math.floor((end - start) / 1000)
        await supabase
          .from('user_sessions')
          .update({
            session_end: new Date().toISOString(),
            duration_seconds: duration,
          })
          .eq('id', sessionIdRef.current)
      }
    }

    window.addEventListener('beforeunload', handleUnload)
    return () => {
      window.removeEventListener('beforeunload', handleUnload)
      clearInterval(activityInterval)
    }
  }, [session])

  // Track login event
  useEffect(() => {
    if (!session?.user) return

    async function trackLogin() {
      try {
        await supabase.from('login_logs').insert({
          user_id: session.user.id,
          email: session.user.email,
        })
        console.log('[App] Login tracked:', session.user.email)
      } catch (err) {
        console.error('[App] trackLogin error:', err)
      }
    }

    trackLogin()
  }, [session])

  // Track page views
  const trackPageView = useCallback(
    async (pageName) => {
      if (!session?.user || !sessionIdRef.current) return

      try {
        await supabase.from('page_views').insert({
          user_id: session.user.id,
          session_id: sessionIdRef.current,
          page_name: pageName,
          page_url: window.location.href,
          device_info: navigator.userAgent,
        })
        console.log('[App] Page view tracked:', pageName)
      } catch (err) {
        console.error('[App] trackPageView error:', err)
      }
    },
    [session]
  )

  useEffect(() => {
    if (session?.user) {
      trackPageView('Dashboard')
    }
  }, [session, trackPageView])

  // ---------------------------------------------------------------------------
  // Load user role, profile, subscription
  // ---------------------------------------------------------------------------
  const loadUserRole = useCallback(async (userId) => {
    try {
      const { data } = await supabase
        .from('user_preferences')
        .select('role')
        .eq('id', userId)
        .maybeSingle()

      if (data?.role) {
        setUserRole(data.role)
      }
    } catch (err) {
      console.error('[App] loadUserRole error:', err)
    }
  }, [])

  const loadUserProfile = useCallback(async (userId) => {
    try {
      const { data } = await supabase
        .from('user_preferences')
        .select('display_name, title')
        .eq('id', userId)
        .maybeSingle()

      if (data) {
        setUserName(data.display_name || '')
        setUserTitle(data.title || '')
      }
    } catch (err) {
      console.error('[App] loadUserProfile error:', err)
    }
  }, [])

  const loadSubscription = useCallback(async (userId) => {
    try {
      const { data } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('user_id', userId)
        .maybeSingle()

      // Auto-PRO for CEO and testers
      const ceoEmail = 'lifeliftusa@gmail.com'
      const testEmails = ['tester1@example.com', 'tester2@example.com']
      const userEmail = session?.user?.email

      if (userEmail === ceoEmail || testEmails.includes(userEmail)) {
        setSubscriptionStatus('pro')
      } else if (data?.status === 'pro') {
        setSubscriptionStatus('pro')
      } else {
        setSubscriptionStatus('free')
      }
    } catch (err) {
      console.error('[App] loadSubscription error:', err)
      setSubscriptionStatus('free')
    }
  }, [session])

  useEffect(() => {
    if (session?.user) {
      loadUserRole(session.user.id)
      loadUserProfile(session.user.id)
      loadSubscription(session.user.id)
    }
  }, [session, loadUserRole, loadUserProfile, loadSubscription])

  // ---------------------------------------------------------------------------
  // Load categories
  // ---------------------------------------------------------------------------
  const loadCategories = useCallback(async (userId) => {
    try {
      const { data } = await supabase
        .from('categories')
        .select('id, name, icon, color')
        .eq('user_id', userId)
        .order('name')

      if (data) {
        setCategories(data)
      }
    } catch (err) {
      console.error('[App] loadCategories error:', err)
    }
  }, [])

  useEffect(() => {
    if (session?.user) {
      loadCategories(session.user.id)
    }
  }, [session, loadCategories])

  // ---------------------------------------------------------------------------
  // Load expenses
  // ---------------------------------------------------------------------------
  const loadExpenses = useCallback(
    async (userId) => {
      try {
        const { data: allData } = await supabase
          .from('expenses')
          .select('*')
          .eq('user_id', userId)
          .order('spent_at', { ascending: false })

        if (allData) {
          setAllExpenses(allData)

          // Build merchant memory for category suggestions
          const map = new Map()
          allData.forEach((exp) => {
            if (exp.merchant && exp.category_id) {
              map.set(exp.merchant.toLowerCase(), exp.category_id)
            }
          })
          merchantMemoryRef.current = map

          // Filter for current view
          let filtered = allData.filter((e) => {
            if (showArchived && !e.archived) return false
            if (!showArchived && e.archived) return false
            return true
          })

          if (search) {
            const lowerSearch = search.toLowerCase()
            filtered = filtered.filter(
              (e) =>
                e.merchant?.toLowerCase().includes(lowerSearch) ||
                e.notes?.toLowerCase().includes(lowerSearch)
            )
          }

          setExpenses(filtered)
        }
      } catch (err) {
        console.error('[App] loadExpenses error:', err)
      }
    },
    [showArchived, search]
  )

  useEffect(() => {
    if (session?.user) {
      loadExpenses(session.user.id)
    }
  }, [session, showArchived, search, loadExpenses])

  // ---------------------------------------------------------------------------
  // AI Insights (Pro feature)
  // ---------------------------------------------------------------------------
  const calculateAIInsights = useCallback(() => {
    if (!isProMode || allExpenses.length === 0) {
      setAiInsights(null)
      return
    }

    try {
      const now = new Date()
      const currentMonth = now.getMonth()
      const currentYear = now.getFullYear()

      const thisMonthExpenses = allExpenses.filter((e) => {
        if (e.archived) return false
        const d = new Date(e.spent_at)
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear
      })

      // Forecast: sum of this month's expenses
      const forecastTotal = thisMonthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0)

      // Recurring expenses: merchants appearing 2+ times this month
      const merchantCounts = {}
      thisMonthExpenses.forEach((e) => {
        const m = e.merchant || 'Unknown'
        merchantCounts[m] = (merchantCounts[m] || 0) + 1
      })
      const recurringExpenses = Object.keys(merchantCounts).filter(
        (m) => merchantCounts[m] >= 2
      )

      // Top categories by spending
      const categorySpending = {}
      thisMonthExpenses.forEach((e) => {
        const cat = categories.find((c) => c.id === e.category_id)
        const name = cat?.name || 'Unknown'
        categorySpending[name] = (categorySpending[name] || 0) + (e.amount || 0)
      })
      const sorted = Object.entries(categorySpending)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, spent]) => ({ name, spent }))

      setAiInsights({
        forecastTotal,
        recurringExpenses,
        categorySpending: sorted,
      })
    } catch (err) {
      console.error('[App] calculateAIInsights error:', err)
    }
  }, [isProMode, allExpenses, categories])

  useEffect(() => {
    if (isProMode && allExpenses.length > 0 && categories.length > 0) {
      calculateAIInsights()
    }
  }, [isProMode, allExpenses, categories, calculateAIInsights])

  // ---------------------------------------------------------------------------
  // AI command handler (Nova)
  // ---------------------------------------------------------------------------
  const handleAICommand = useCallback(
    async (command) => {
      console.log('[App] AI command received:', command)

      if (command.action === 'add_expense') {
        const { merchant: m, amount: a, category: c, date_hint } = command

        // Validate amount
        if (!a || isNaN(a) || a <= 0) {
          console.warn('[App] Invalid amount:', a)
          return
        }

        // Resolve category
        let resolvedCategoryId = categoryId
        if (c) {
          const found = categories.find(
            (cat) => cat.name.toLowerCase() === c.toLowerCase()
          )
          if (found) {
            resolvedCategoryId = found.id
          }
        }

        // Resolve date
        let resolvedDate = spentAtLocal
        if (date_hint) {
          const parsed = parseNaturalDate(date_hint)
          if (parsed) {
            resolvedDate = parsed
          }
        }

        // Set form
        setMerchant(m || '')
        setAmount(String(a))
        setCategoryId(resolvedCategoryId)
        setSpentAtLocal(resolvedDate)

        // Auto-submit
        setTimeout(() => {
          const btn = document.querySelector('button[type="submit"]')
          if (btn) btn.click()
        }, 100)

        return
      }

      if (command.action === 'update_expense') {
        const { target, updates } = command
        let expenseToUpdate = null

        if (target?.id) {
          expenseToUpdate = expenses.find((e) => e.id === target.id)
        } else if (target?.merchant) {
          expenseToUpdate = expenses.find(
            (e) => e.merchant?.toLowerCase() === target.merchant.toLowerCase()
          )
        }

        if (expenseToUpdate && updates) {
          await updateExpense(expenseToUpdate.id, updates)
          await loadExpenses(session.user.id)
        }

        return
      }

      if (command.action === 'search') {
        setSearch(command.query || '')
        return
      }

      if (command.action === 'export') {
        exportCsv()
        return
      }
    },
    [
      categoryId,
      spentAtLocal,
      categories,
      expenses,
      session,
      loadExpenses,
    ]
  )

  // ---------------------------------------------------------------------------
  // Helper: parse natural date strings
  // ---------------------------------------------------------------------------
  function parseNaturalDate(hint) {
    const lower = hint.toLowerCase()
    const now = new Date()

    if (lower.includes('yesterday')) {
      const d = new Date(now)
      d.setDate(d.getDate() - 1)
      return d.toISOString().slice(0, 16)
    }

    const daysAgoMatch = lower.match(/(\d+)\s*days?\s*ago/)
    if (daysAgoMatch) {
      const days = parseInt(daysAgoMatch[1], 10)
      const d = new Date(now)
      d.setDate(d.getDate() - days)
      return d.toISOString().slice(0, 16)
    }

    if (lower.includes('last week')) {
      const d = new Date(now)
      d.setDate(d.getDate() - 7)
      return d.toISOString().slice(0, 16)
    }

    return null
  }

  // ---------------------------------------------------------------------------
  // Category suggestion using merchant memory + OpenAI fallback
  // ---------------------------------------------------------------------------
  const suggestCategoryForMerchant = useCallback(
    async (merchantName) => {
      if (!merchantName) return categoryId

      const lowerMerchant = merchantName.toLowerCase()

      // Check memory first
      if (merchantMemoryRef.current.has(lowerMerchant)) {
        return merchantMemoryRef.current.get(lowerMerchant)
      }

      // Fallback to OpenAI
      try {
        const apiKey = process.env.REACT_APP_OPENAI_API_KEY
        if (!apiKey) {
          console.warn('[App] No OpenAI API key found')
          return categories[0]?.id || ''
        }

        const categoryNames = categories.map((c) => c.name).join(', ')
        const prompt = `You are a helpful assistant. Given the merchant name "${merchantName}", suggest the most appropriate category from this list: ${categoryNames}. Respond with only the category name.`

        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 50,
          }),
        })

        const json = await res.json()
        const suggested = json.choices?.[0]?.message?.content?.trim()

        if (suggested) {
          const found = categories.find(
            (c) => c.name.toLowerCase() === suggested.toLowerCase()
          )
          if (found) {
            merchantMemoryRef.current.set(lowerMerchant, found.id)
            return found.id
          }
        }

        return categories[0]?.id || ''
      } catch (err) {
        console.error('[App] suggestCategoryForMerchant error:', err)
        return categories[0]?.id || ''
      }
    },
    [categoryId, categories]
  )

  // ---------------------------------------------------------------------------
  // Receipt OCR processing with OpenAI
  // ---------------------------------------------------------------------------
  const processReceiptWithOCR = useCallback(
    async (file) => {
      if (!file) return

      setIsProcessingReceipt(true)

      try {
        const userId = session?.user?.id
        if (!userId) throw new Error('No user ID')

        // Upload to storage
        const sanitized = sanitizeFilename(file.name)
        const filePath = `${userId}/${Date.now()}_${sanitized}`
        const { error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(filePath, file)

        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(filePath)
        const publicUrl = urlData?.publicUrl || ''

        if (publicUrl) {
          setReceiptUrls((prev) => [...prev, publicUrl])
        }

        // Convert to base64 for OpenAI
        const base64 = await fileToBase64(file)

        // Call OpenAI Vision
        const apiKey = process.env.REACT_APP_OPENAI_API_KEY
        if (!apiKey) throw new Error('No OpenAI API key')

        const prompt = `Extract the following information from this receipt image in JSON format:
{
  "merchant": "name of merchant",
  "amount": <total amount as number>,
  "date": "YYYY-MM-DD",
  "items": ["item1", "item2"]
}
If any field is missing, use null.`

        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: prompt },
                  { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
                ],
              },
            ],
            max_tokens: 500,
          }),
        })

        const json = await res.json()
        const content = json.choices?.[0]?.message?.content?.trim()

        if (content) {
          const parsed = JSON.parse(content)
          if (parsed.merchant) setMerchant(parsed.merchant)
          if (parsed.amount) setAmount(String(parsed.amount))
          if (parsed.date) {
            const d = new Date(parsed.date)
            setSpentAtLocal(d.toISOString().slice(0, 16))
          }
          if (parsed.items && parsed.items.length > 0) {
            setNotes(parsed.items.join(', '))
          }

          console.log('[App] Receipt processed:', parsed)
        }
      } catch (err) {
        console.error('[App] processReceiptWithOCR error:', err)
      } finally {
        setIsProcessingReceipt(false)
      }
    },
    [session]
  )

  // Helper: file to base64
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result.split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  // Helper: sanitize filename
  function sanitizeFilename(name) {
    return name.replace(/[^a-zA-Z0-9._-]/g, '_')
  }

  // ---------------------------------------------------------------------------
  // Add expense
  // ---------------------------------------------------------------------------
  const addExpense = useCallback(
    async (e) => {
      e.preventDefault()

      if (!merchant.trim() || !amount || !categoryId) {
        alert('Please fill in merchant, amount, and category.')
        return
      }

      const amountNum = parseFloat(amount)
      if (isNaN(amountNum) || amountNum <= 0) {
        alert('Amount must be a positive number.')
        return
      }

      setIsSaving(true)
      setSaveSuccess(false)

      try {
        const userId = session?.user?.id
        if (!userId) throw new Error('No user ID')

        // Upload receipt if present
        let receiptImageUrl = null
        if (receiptFile) {
          const sanitized = sanitizeFilename(receiptFile.name)
          const filePath = `${userId}/${Date.now()}_${sanitized}`
          const { error: uploadError } = await supabase.storage
            .from('receipts')
            .upload(filePath, receiptFile)

          if (uploadError) throw uploadError

          const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(filePath)
          receiptImageUrl = urlData?.publicUrl || null
        }

        // Get geolocation
        let location = null
        if (navigator.geolocation) {
          const pos = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject)
          })
          const { latitude, longitude } = pos.coords
          location = await getLocationString(latitude, longitude)
        }

        // Parse tags
        const tags = tagsText
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t)

        // Insert expense
        const { error: insertError } = await supabase.from('expenses').insert({
          user_id: userId,
          category_id: categoryId,
          merchant: merchant.trim(),
          amount: amountNum,
          payment_method: paymentMethod,
          spent_at: new Date(spentAtLocal).toISOString(),
          status,
          notes: notes.trim() || null,
          tax_deductible: isTaxDeductible,
          reimbursable: isReimbursable,
          employer_or_client: employerOrClient.trim() || null,
          tags: tags.length > 0 ? tags : null,
          location: location || null,
          receipt_image_url: receiptImageUrl,
        })

        if (insertError) throw insertError

        // Reset form
        setMerchant('')
        setAmount('')
        setCategoryId('')
        setPaymentMethod('card')
        setSpentAtLocal(getNowLocalDateTime())
        setStatus('cleared')
        setNotes('')
        setIsTaxDeductible(false)
        setIsReimbursable(false)
        setEmployerOrClient('')
        setTagsText('')
        setReceiptFile(null)
        setReceiptUrls([])
        setShowMoreOptions(false)

        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000)

        // Reload expenses
        await loadExpenses(userId)
      } catch (err) {
        console.error('[App] addExpense error:', err)
        alert('Failed to add expense.')
      } finally {
        setIsSaving(false)
      }
    },
    [
      merchant,
      amount,
      categoryId,
      paymentMethod,
      spentAtLocal,
      status,
      notes,
      isTaxDeductible,
      isReimbursable,
      employerOrClient,
      tagsText,
      receiptFile,
      session,
      loadExpenses,
    ]
  )

  // Helper: reverse geocode location
  async function getLocationString(lat, lon) {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
      )
      const data = await res.json()
      return data?.display_name || null
    } catch (err) {
      console.error('[App] getLocationString error:', err)
      return null
    }
  }

  // ---------------------------------------------------------------------------
  // Update expense
  // ---------------------------------------------------------------------------
  const updateExpense = useCallback(
    async (id, updates) => {
      try {
        const { error } = await supabase.from('expenses').update(updates).eq('id', id)

        if (error) throw error

        await loadExpenses(session?.user?.id)
      } catch (err) {
        console.error('[App] updateExpense error:', err)
      }
    },
    [session, loadExpenses]
  )

  // ---------------------------------------------------------------------------
  // Archive expense (soft delete)
  // ---------------------------------------------------------------------------
  const setArchivedForExpense = useCallback(
    async (id, archived) => {
      try {
        const { error } = await supabase.from('expenses').update({ archived }).eq('id', id)

        if (error) throw error

        await loadExpenses(session?.user?.id)
      } catch (err) {
        console.error('[App] setArchivedForExpense error:', err)
      }
    },
    [session, loadExpenses]
  )

  // Archive with undo banner
  const archiveWithUndo = useCallback(
    async (id) => {
      const expense = expenses.find((e) => e.id === id)
      if (!expense) return

      await setArchivedForExpense(id, true)

      setUndoBanner({
        message: `Archived "${expense.merchant}"`,
        undo: async () => {
          await setArchivedForExpense(id, false)
          setUndoBanner(null)
        },
      })

      setTimeout(() => setUndoBanner(null), 5000)
    },
    [expenses, setArchivedForExpense]
  )

  // ---------------------------------------------------------------------------
  // Delete expense
  // ---------------------------------------------------------------------------
  const deleteExpense = useCallback(
    async (id) => {
      if (!window.confirm('Permanently delete this expense?')) return

      try {
        const { error } = await supabase.from('expenses').delete().eq('id', id)

        if (error) throw error

        await loadExpenses(session?.user?.id)
      } catch (err) {
        console.error('[App] deleteExpense error:', err)
      }
    },
    [session, loadExpenses]
  )

  // ---------------------------------------------------------------------------
  // Open receipt image
  // ---------------------------------------------------------------------------
  const openReceipt = useCallback(async (receiptImageUrl) => {
    try {
      window.open(receiptImageUrl, '_blank')
    } catch (err) {
      console.error('[App] openReceipt error:', err)
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Export CSV
  // ---------------------------------------------------------------------------
  const exportCsv = useCallback(() => {
    if (allExpenses.length === 0) {
      alert('No expenses to export.')
      return
    }

    const headers = [
      'Date',
      'Merchant',
      'Category',
      'Amount',
      'Payment Method',
      'Status',
      'Notes',
    ]

    const rows = allExpenses.map((e) => {
      const cat = categories.find((c) => c.id === e.category_id)
      return [
        e.spent_at ? new Date(e.spent_at).toLocaleDateString() : '',
        e.merchant || '',
        cat?.name || '',
        e.amount || 0,
        e.payment_method || '',
        e.status || '',
        e.notes || '',
      ]
    })

    const csvContent = [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `expenses_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [allExpenses, categories])

  function csvEscape(val) {
    if (val == null) return ''
    const str = String(val)
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  // ---------------------------------------------------------------------------
  // Import flow
  // ---------------------------------------------------------------------------
  const handleTransactionsParsed = useCallback((transactions) => {
    setImportedTransactions(transactions)
  }, [])

  const handleImport = useCallback(
    async (finalTransactions) => {
      try {
        const userId = session?.user?.id
        if (!userId) throw new Error('No user ID')

        const rows = finalTransactions.map((t) => ({
          user_id: userId,
          category_id: t.category_id,
          merchant: t.merchant,
          amount: t.amount,
          payment_method: t.payment_method || 'card',
          spent_at: t.spent_at ? new Date(t.spent_at).toISOString() : new Date().toISOString(),
          status: t.status || 'cleared',
          notes: t.notes || null,
        }))

        const { error } = await supabase.from('expenses').insert(rows)

        if (error) throw error

        alert(`Imported ${rows.length} expenses.`)
        setShowImport(false)
        setImportedTransactions([])

        await loadExpenses(userId)
      } catch (err) {
        console.error('[App] handleImport error:', err)
        alert('Failed to import expenses.')
      }
    },
    [session, loadExpenses]
  )

  const handleCancelImport = useCallback(() => {
    setShowImport(false)
    setImportedTransactions([])
  }, [])

  // ---------------------------------------------------------------------------
  // Handle login (for Login component)
  // ---------------------------------------------------------------------------
  const handleLogin = useCallback(
    (session) => {
      setSession(session)
    },
    []
  )

  // ---------------------------------------------------------------------------
  // Render: not logged in
  // ---------------------------------------------------------------------------
  if (!session) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <h1>Nova Expense Tracker</h1>
        <Login onLogin={handleLogin} />
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render: logged in
  // ---------------------------------------------------------------------------
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 20, fontFamily: 'sans-serif' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <h1 style={{ margin: 0 }}>Nova Expense Tracker</h1>

        {/* User greeting (centered) */}
        {userName && (
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 'bold' }}>Hello {userName}</div>
            {userTitle && <div style={{ fontSize: 14, color: '#666' }}>{userTitle}</div>}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* Test mode toggle for admins */}
          {isAdmin && (
            <button
              onClick={() => setTestMode((prev) => !prev)}
              style={{
                padding: '8px 12px',
                background: testMode ? '#fbbf24' : '#10b981',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              {testMode ? 'Test Mode (Basic)' : 'PRO Mode'}
            </button>
          )}

          {/* Admin actions: Login History (admins only) */}
          {isAdmin && (
            <button
              onClick={() => setShowLoginHistory((prev) => !prev)}
              style={{
                padding: '8px 12px',
                background: '#3b82f6',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              Login History
            </button>
          )}

          {/* Admin actions: Analytics (admins only) */}
          {isAdmin && (
            <button
              onClick={() => setShowAnalytics((prev) => !prev)}
              style={{
                padding: '8px 12px',
                background: '#10b981',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              Analytics
            </button>
          )}

          {/* Import */}
          <button
            onClick={() => setShowImport((prev) => !prev)}
            style={{
              padding: '8px 12px',
              background: '#8b5cf6',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Import
          </button>

          {/* Export */}
          <button
            onClick={exportCsv}
            style={{
              padding: '8px 12px',
              background: '#06b6d4',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Export CSV
          </button>

          {/* Logout */}
          <button
            onClick={async () => {
              await supabase.auth.signOut()
              setSession(null)
            }}
            style={{
              padding: '8px 12px',
              background: '#ef4444',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* Undo banner */}
      {undoBanner && (
        <div
          style={{
            background: '#fbbf24',
            color: '#000',
            padding: 12,
            borderRadius: 8,
            marginBottom: 20,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{undoBanner.message}</span>
          <button
            onClick={undoBanner.undo}
            style={{
              background: '#fff',
              border: 'none',
              padding: '6px 12px',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Undo
          </button>
        </div>
      )}

      {/* Nova ChatAssistant - NOW VISIBLE TO ALL USERS */}
      <div style={{ marginBottom: 20 }}>
        <ChatAssistant
          userId={session.user.id}
          expenses={allExpenses}
          categories={categories}
          onCommand={handleAICommand}
          notifications={[]}
          isProMode={isProMode}
        />
      </div>

      {/* AI Insights (PRO only) */}
      {isProMode && aiInsights && (
        <div
          style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: '#fff',
            padding: 20,
            borderRadius: 12,
            marginBottom: 20,
          }}
        >
          <h3 style={{ margin: '0 0 10px 0' }}>AI Insights (PRO)</h3>
          <div>
            <strong>Forecast This Month:</strong> ${aiInsights.forecastTotal.toFixed(2)}
          </div>
          {aiInsights.recurringExpenses.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <strong>Recurring Merchants:</strong> {aiInsights.recurringExpenses.join(', ')}
            </div>
          )}
          {aiInsights.categorySpending.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <strong>Top Categories:</strong>
              <ul style={{ margin: '4px 0 0 20px', padding: 0 }}>
                {aiInsights.categorySpending.map((c) => (
                  <li key={c.name}>
                    {c.name}: ${c.spent.toFixed(2)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Upgrade banner (free users only) */}
      {!isProMode && (
        <div
          style={{
            background: '#fef3c7',
            padding: 16,
            borderRadius: 8,
            marginBottom: 20,
            textAlign: 'center',
          }}
        >
          <strong>Upgrade to PRO</strong> for AI insights, forecasts, and more!
          <button
            onClick={() => setShowPaywall(true)}
            style={{
              marginLeft: 12,
              padding: '8px 16px',
              background: '#10b981',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Upgrade
          </button>
        </div>
      )}

      {/* Paywall modal */}
      {showPaywall && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: '#fff',
              padding: 40,
              borderRadius: 12,
              maxWidth: 400,
              textAlign: 'center',
            }}
          >
            <h2>Upgrade to PRO</h2>
            <p>Unlock AI insights, forecasting, and advanced analytics.</p>
            <button
              onClick={() => {
                console.log('[App] Stripe checkout initiated')
                alert('Stripe checkout would open here.')
                setShowPaywall(false)
              }}
              style={{
                padding: '12px 24px',
                background: '#10b981',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 16,
              }}
            >
              Upgrade Now
            </button>
            <button
              onClick={() => setShowPaywall(false)}
              style={{
                marginTop: 12,
                padding: '8px 16px',
                background: '#e5e7eb',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Login History (admins only) */}
      {showLoginHistory && isAdmin && (
        <div style={{ marginBottom: 20 }}>
          <h3>Login History</h3>
          <div
            style={{
              padding: 20,
              background: '#f3f4f6',
              borderRadius: 8,
            }}
          >
            Login history will appear here.
          </div>
        </div>
      )}

      {/* Analytics Dashboard (admins only) */}
      {showAnalytics && isAdmin && (
        <div style={{ marginBottom: 20 }}>
          <AnalyticsDashboard />
        </div>
      )}

      {/* Import flow */}
      {showImport && importedTransactions.length === 0 && (
        <div style={{ marginBottom: 20 }}>
          <FileImport onTransactionsParsed={handleTransactionsParsed} />
        </div>
      )}

      {showImport && importedTransactions.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <ImportPreview
            transactions={importedTransactions}
            categories={categories}
            onImport={handleImport}
            onCancel={handleCancelImport}
          />
        </div>
      )}

      {/* Add expense form */}
      <AddExpenseForm
        categories={categories}
        amount={amount}
        setAmount={setAmount}
        merchant={merchant}
        setMerchant={setMerchant}
        categoryId={categoryId}
        setCategoryId={setCategoryId}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        spentAtLocal={spentAtLocal}
        setSpentAtLocal={setSpentAtLocal}
        status={status}
        setStatus={setStatus}
        notes={notes}
        setNotes={setNotes}
        isTaxDeductible={isTaxDeductible}
        setIsTaxDeductible={setIsTaxDeductible}
        isReimbursable={isReimbursable}
        setIsReimbursable={setIsReimbursable}
        employerOrClient={employerOrClient}
        setEmployerOrClient={setEmployerOrClient}
        tagsText={tagsText}
        setTagsText={setTagsText}
        receiptFile={receiptFile}
        setReceiptFile={setReceiptFile}
        receiptUrls={receiptUrls}
        isProcessingReceipt={isProcessingReceipt}
        processReceiptWithOCR={processReceiptWithOCR}
        showMoreOptions={showMoreOptions}
        setShowMoreOptions={setShowMoreOptions}
        isSaving={isSaving}
        saveSuccess={saveSuccess}
        addExpense={addExpense}
        isProMode={isProMode}
      />

      {/* Monthly Summary */}
      <MonthlySummary expenses={allExpenses} categories={categories} />

      {/* Expense list */}
      <ExpenseList
        expenses={expenses}
        categories={categories}
        updateExpense={updateExpense}
        archiveWithUndo={archiveWithUndo}
        deleteExpense={deleteExpense}
        openReceipt={openReceipt}
      />
    </div>
  )
}

export default App