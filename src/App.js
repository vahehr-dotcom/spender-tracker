import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { supabase } from './supabaseClient'

import Login from './components/Login'
import ChatAssistant from './components/ChatAssistant'
import AddExpenseForm from './components/AddExpenseForm'
import ExpenseList from './components/ExpenseList'
import MonthlySummary from './components/MonthlySummary'
import FileImport from './components/FileImport'
import ImportPreview from './components/ImportPreview'
import LoginHistory from './components/LoginHistory'
import ProactiveEngine from './lib/ProactiveEngine'
import PatternAnalyzer from './lib/PatternAnalyzer'
import PredictiveEngine from './lib/PredictiveEngine'

function App() {
  const [session, setSession] = useState(null)
  const [subscriptionStatus, setSubscriptionStatus] = useState('free')
  const [showPaywall, setShowPaywall] = useState(false)
  const [userRole, setUserRole] = useState('user')
  const [showLoginHistory, setShowLoginHistory] = useState(false)

  const [categories, setCategories] = useState([])
  const [expenses, setExpenses] = useState([])
  const [allExpenses, setAllExpenses] = useState([])

  const [amount, setAmount] = useState('')
  const [merchant, setMerchant] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('card')
  const [spentAtLocal, setSpentAtLocal] = useState(getNowLocalDateTime())
  const [status, setStatus] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const [showMoreOptions, setShowMoreOptions] = useState(true)
  const [isTaxDeductible, setIsTaxDeductible] = useState(false)
  const [notes, setNotes] = useState('')

  const isProMode = subscriptionStatus === 'pro'
  const isAdmin = userRole === 'admin'
  const [isReimbursable, setIsReimbursable] = useState(false)
  const [employerOrClient, setEmployerOrClient] = useState('')
  const [tagsText, setTagsText] = useState('')

  const [budgets, setBudgets] = useState({})
  const [showBudgetPanel, setShowBudgetPanel] = useState(false)
  const [aiInsights, setAiInsights] = useState(null)

  const [showAddCategory, setShowAddCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')

  const [receiptFile, setReceiptFile] = useState(null)
  const [receiptUrls, setReceiptUrls] = useState([])
  const [isProcessingReceipt, setIsProcessingReceipt] = useState(false)

  const [showArchived, setShowArchived] = useState(false)
  const [search, setSearch] = useState('')
  const [undoBanner, setUndoBanner] = useState(null)
  const undoTimerRef = useRef(null)

  const merchantMemoryRef = useRef({})
  const [categoryLearnedSource, setCategoryLearnedSource] = useState(null)

  const [showImport, setShowImport] = useState(false)
  const [importedTransactions, setImportedTransactions] = useState([])

  const [notifications, setNotifications] = useState([])

  // 🔥 FIX: Store allExpenses in ref so handleAICommand always has latest
  const allExpensesRef = useRef([])
  
  // 🆕 Session tracking
  const sessionIdRef = useRef(null)
  const activityTimerRef = useRef(null)

  // 📊 Analytics tracking
  const currentPageRef = useRef('dashboard')
  const pageStartTimeRef = useRef(null)
  const lastActivityRef = useRef(Date.now())
  const idleTimerRef = useRef(null)
  const pageViewIdRef = useRef(null)
  
  useEffect(() => {
    allExpensesRef.current = allExpenses
  }, [allExpenses])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  // 🆕 Track login with device info
  useEffect(() => {
    if (session) {
      const deviceInfo = {
        user_agent: navigator.userAgent,
        platform: navigator.platform,
        timestamp: new Date().toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }

      supabase.from('login_logs').insert({
        user_id: session.user.id,
        email: session.user.email,
        device_info: deviceInfo,
        logged_in_at: new Date().toISOString()
      }).then(() => {
        console.log('📝 Login tracked:', session.user.email)
      }).catch(err => {
        console.warn('Login tracking failed:', err)
      })
    }
  }, [session])

  // 🆕 Session duration tracking - FIXED to prevent duplicates
  useEffect(() => {
    if (!session) return

    const startSession = async () => {
      const deviceInfo = {
        user_agent: navigator.userAgent,
        platform: navigator.platform,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }

      // Check if there's already an active session
      const { data: existingSessions } = await supabase
        .from('user_sessions')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('is_active', true)
        .order('session_start', { ascending: false })
        .limit(1)

      if (existingSessions && existingSessions.length > 0) {
        // Reuse existing session
        sessionIdRef.current = existingSessions[0].id
        console.log('🔄 Continuing existing session:', sessionIdRef.current)
        
        // Update last activity
        await supabase
          .from('user_sessions')
          .update({ last_activity: new Date().toISOString() })
          .eq('id', sessionIdRef.current)
      } else {
        // Create new session
        const { data, error } = await supabase
          .from('user_sessions')
          .insert({
            user_id: session.user.id,
            email: session.user.email,
            session_start: new Date().toISOString(),
            device_info: deviceInfo,
            last_activity: new Date().toISOString(),
            is_active: true
          })
          .select()
          .single()

        if (!error && data) {
          sessionIdRef.current = data.id
          console.log('⏱️ New session started:', data.id)
        }
      }
    }

    startSession()

    // Update activity every 30 seconds
    const activityInterval = setInterval(async () => {
      if (sessionIdRef.current) {
        await supabase
          .from('user_sessions')
          .update({
            last_activity: new Date().toISOString()
          })
          .eq('id', sessionIdRef.current)
      }
    }, 30000)

    // End session on page unload
    const endSession = async () => {
      if (sessionIdRef.current) {
        const { data: sessionData } = await supabase
          .from('user_sessions')
          .select('session_start')
          .eq('id', sessionIdRef.current)
          .single()

        if (sessionData) {
          const sessionStart = new Date(sessionData.session_start)
          const sessionEnd = new Date()
          const durationSeconds = Math.floor((sessionEnd - sessionStart) / 1000)

          await supabase
            .from('user_sessions')
            .update({
              session_end: sessionEnd.toISOString(),
              duration_seconds: durationSeconds,
              is_active: false
            })
            .eq('id', sessionIdRef.current)
          
          console.log('⏹️ Session ended. Duration:', durationSeconds, 'seconds')
        }
      }
    }

    window.addEventListener('beforeunload', endSession)

    return () => {
      clearInterval(activityInterval)
      window.removeEventListener('beforeunload', endSession)
      endSession()
    }
  }, [session])

  // 📊 Page view tracking
  const trackPageView = useCallback(async (pageName) => {
    if (!session || !sessionIdRef.current) return

    // End previous page view
    if (pageViewIdRef.current && pageStartTimeRef.current) {
      const duration = Math.floor((Date.now() - pageStartTimeRef.current) / 1000)
      await supabase
        .from('page_views')
        .update({ duration_seconds: duration })
        .eq('id', pageViewIdRef.current)
    }

    // Start new page view
    const deviceInfo = {
      user_agent: navigator.userAgent,
      platform: navigator.platform,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }

    const { data, error } = await supabase
      .from('page_views')
      .insert({
        user_id: session.user.id,
        email: session.user.email,
        page_name: pageName,
        page_url: window.location.pathname,
        session_id: sessionIdRef.current,
        device_info: deviceInfo,
        viewed_at: new Date().toISOString()
      })
      .select()
      .single()

    if (!error && data) {
      pageViewIdRef.current = data.id
      pageStartTimeRef.current = Date.now()
      currentPageRef.current = pageName
      console.log('📄 Page view tracked:', pageName)
    }
  }, [session])

  // 📊 Activity tracking
  const trackActivity = useCallback(async (activityType, activityData = {}) => {
    if (!session || !sessionIdRef.current) return

    await supabase
      .from('user_activities')
      .insert({
        user_id: session.user.id,
        email: session.user.email,
        session_id: sessionIdRef.current,
        activity_type: activityType,
        activity_data: activityData,
        page_name: currentPageRef.current,
        created_at: new Date().toISOString()
      })

    console.log('🎯 Activity tracked:', activityType)
  }, [session])

  // 📊 Idle detection
  useEffect(() => {
    if (!session) return

    const resetIdleTimer = () => {
      lastActivityRef.current = Date.now()
      
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current)
      }

      // Set idle after 2 minutes of inactivity
      idleTimerRef.current = setTimeout(() => {
        console.log('😴 User is idle')
        trackActivity('user_idle', { idle_duration: 120 })
      }, 2 * 60 * 1000)
    }

    const handleActivity = () => {
      resetIdleTimer()
    }

    // Listen to user activity
    window.addEventListener('mousemove', handleActivity)
    window.addEventListener('keydown', handleActivity)
    window.addEventListener('click', handleActivity)
    window.addEventListener('scroll', handleActivity)

    resetIdleTimer()

    return () => {
      window.removeEventListener('mousemove', handleActivity)
      window.removeEventListener('keydown', handleActivity)
      window.removeEventListener('click', handleActivity)
      window.removeEventListener('scroll', handleActivity)
      
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current)
      }
    }
  }, [session, trackActivity])

  // 📊 Track page changes
  useEffect(() => {
    if (!session) return

    if (showLoginHistory) {
      trackPageView('login_history')
    } else if (importedTransactions.length > 0) {
      trackPageView('import_preview')
    } else if (showImport) {
      trackPageView('import')
    } else {
      trackPageView('dashboard')
    }
  }, [session, showLoginHistory, showImport, importedTransactions.length, trackPageView])

  // 🆕 Load user role
  useEffect(() => {
    if (session) {
      loadUserRole()
    }
  }, [session])

  const loadUserRole = async () => {
    if (!session) return
    try {
      const { data } = await supabase
        .from('user_preferences')
        .select('preference_value')
        .eq('user_id', session.user.id)
        .eq('preference_type', 'role')
        .single()
      
      if (data) {
        setUserRole(data.preference_value)
        console.log('👤 User role:', data.preference_value)
      }
    } catch (err) {
      console.log('No role found, defaulting to user')
      setUserRole('user')
    }
  }

  useEffect(() => {
    if (session) {
      loadSubscription()
      loadCategories()
      loadExpenses()
    }
  }, [session])

  useEffect(() => {
    if (isProMode && session && allExpenses.length > 0 && categories.length > 0) {
      const engine = new ProactiveEngine(session.user.id, allExpenses, categories)
      
      engine.generateNotifications().then(() => {
        ProactiveEngine.fetchNotifications(session.user.id).then((notifs) => {
          setNotifications(notifs)
        })
      })
    }
  }, [isProMode, session, allExpenses, categories])

  useEffect(() => {
    if (!isProMode || !session) return

    const interval = setInterval(() => {
      ProactiveEngine.fetchNotifications(session.user.id).then((notifs) => {
        setNotifications(notifs)
      })
    }, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [isProMode, session])

  const dismissNotification = useCallback(async (notificationId) => {
    await ProactiveEngine.dismissNotification(notificationId)
    setNotifications(prev => prev.filter(n => n.id !== notificationId))
  }, [])

  const loadSubscription = async () => {
    if (!session) return
    try {
      const { data } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('user_id', session.user.id)
        .single()
      if (data) setSubscriptionStatus(data.status)
    } catch (err) {
      console.log('No subscription found, using free tier')
    }
  }

  function normalizeMerchantKey(m) {
    return m.toLowerCase().replace(/[^a-z0-9]/g, '')
  }

  const buildMerchantMemory = useCallback((expensesData) => {
    const mem = {}
    for (const exp of expensesData) {
      if (!exp.merchant || !exp.category_id) continue
      const key = normalizeMerchantKey(exp.merchant)
      if (!mem[key]) {
        mem[key] = { categoryId: exp.category_id, count: 0 }
      }
      mem[key].count++
    }
    merchantMemoryRef.current = mem
  }, [])

  const suggestCategoryForMerchant = useCallback(
    (merchantName) => {
      if (!merchantName) return null
      const key = normalizeMerchantKey(merchantName)
      const entry = merchantMemoryRef.current[key]
      if (entry && entry.count >= 2) {
        return entry.categoryId
      }
      return null
    },
    []
  )

  useEffect(() => {
    if (!merchant) {
      setCategoryLearnedSource(null)
      return
    }
    const suggested = suggestCategoryForMerchant(merchant)
    if (suggested) {
      setCategoryId(suggested)
      setCategoryLearnedSource(merchant)
    }
  }, [merchant, suggestCategoryForMerchant])

  const processReceiptWithOCR = useCallback(
    async (file) => {
      if (!file) return
      setIsProcessingReceipt(true)
      trackActivity('receipt_scan_started')
      try {
        const base64 = await fileToBase64(file)
        const payload = {
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Extract: merchant name, total amount, date (YYYY-MM-DD), items. Return JSON: {merchant, amount, date, items:[{name, price}]}'
                },
                {
                  type: 'image_url',
                  image_url: { url: base64 }
                }
              ]
            }
          ],
          max_tokens: 500
        }
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`
          },
          body: JSON.stringify(payload)
        })
        if (!res.ok) throw new Error('OCR failed')
        const json = await res.json()
        const text = json.choices?.[0]?.message?.content || ''
        const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, ''))
        if (parsed.merchant) setMerchant(parsed.merchant)
        if (parsed.amount) setAmount(String(parsed.amount))
        if (parsed.date) {
          const d = new Date(parsed.date)
          if (!isNaN(d)) {
            const local = d.toISOString().slice(0, 16)
            setSpentAtLocal(local)
          }
        }
        if (parsed.items && parsed.items.length > 0) {
          setNotes(parsed.items.map((it) => `${it.name}: $${it.price}`).join('; '))
        }
        trackActivity('receipt_scan_success', { merchant: parsed.merchant })
      } catch (err) {
        console.error('OCR error:', err)
        trackActivity('receipt_scan_failed', { error: err.message })
      } finally {
        setIsProcessingReceipt(false)
      }
    },
    [trackActivity]
  )

  const loadCategories = useCallback(async () => {
    if (!session) return
    const { data, error } = await supabase
      .from('categories')
      .select('id, name, icon, color')
      .eq('user_id', session.user.id)
      .order('name')
    if (error) {
      console.error('Load categories error:', error)
      return
    }
    setCategories(data || [])
  }, [session])

  const ensureReceiptThumb = useCallback(async (expenseId, imgUrl) => {
    if (!imgUrl) return imgUrl
    const { data } = await supabase.storage.from('receipts').createSignedUrl(imgUrl, 60 * 10)
    return data?.signedUrl || imgUrl
  }, [])

  const calculateAIInsights = useCallback(
    async (expensesData, categoriesData) => {
      if (!isProMode || expensesData.length === 0) return
      const now = new Date()
      const currentMonth = now.getMonth()
      const currentYear = now.getFullYear()
      const thisMonth = expensesData.filter((e) => {
        const d = new Date(e.spent_at)
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear
      })
      const totalThisMonth = thisMonth.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0)
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
      const dayOfMonth = now.getDate()
      const avgPerDay = totalThisMonth / dayOfMonth
      const remainingDays = daysInMonth - dayOfMonth
      const forecastTotal = totalThisMonth + avgPerDay * remainingDays

      const merchantCounts = {}
      for (const exp of expensesData) {
        const m = exp.merchant || 'Unknown'
        merchantCounts[m] = (merchantCounts[m] || 0) + 1
      }
      const recurring = Object.entries(merchantCounts)
        .filter(([, count]) => count >= 3)
        .map(([merchant, count]) => ({ merchant, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)

      const catSpending = {}
      for (const exp of thisMonth) {
        const cid = exp.category_id || 'uncategorized'
        catSpending[cid] = (catSpending[cid] || 0) + parseFloat(exp.amount || 0)
      }
      const categorySpending = categoriesData
        .map((cat) => ({
          name: cat.name,
          icon: cat.icon,
          total: catSpending[cat.id] || 0
        }))
        .filter((c) => c.total > 0)
        .sort((a, b) => b.total - a.total)

      setAiInsights({
        forecastTotal: forecastTotal.toFixed(2),
        recurringExpenses: recurring,
        categorySpending
      })
    },
    [isProMode]
  )

  const loadExpenses = useCallback(async () => {
    if (!session) return
    let query = supabase
      .from('expenses')
      .select(
        'id, amount, merchant, payment_method, spent_at, created_at, category_id, receipt_image_url, is_tax_deductible, is_reimbursable, employer_or_client, notes, archived, tags, location'
      )
      .eq('user_id', session.user.id)
      .order('spent_at', { ascending: false })

    if (!showArchived) {
      query = query.eq('archived', false)
    }
    if (search) {
      query = query.or(
        `merchant.ilike.${escapeIlike(search)},notes.ilike.${escapeIlike(search)}`
      )
    }

    const { data, error } = await query
    if (error) {
      console.error('Load expenses error:', error)
      return
    }
    setExpenses(data || [])

    const { data: allData, error: allError } = await supabase
      .from('expenses')
      .select(
        'id, amount, merchant, payment_method, spent_at, created_at, category_id, receipt_image_url, is_tax_deductible, is_reimbursable, employer_or_client, notes, archived, tags, location'
      )
      .eq('user_id', session.user.id)
      .order('spent_at', { ascending: false })

    if (!allError && allData) {
      setAllExpenses(allData)
      buildMerchantMemory(allData)
    }
  }, [session, showArchived, search, buildMerchantMemory])

  useEffect(() => {
    if (allExpenses.length > 0 && categories.length > 0) {
      calculateAIInsights(allExpenses, categories)
    }
  }, [allExpenses, categories, calculateAIInsights])

  const login = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) alert(error.message)
  }

  const logout = async () => {
    trackActivity('logout')
    await supabase.auth.signOut()
    setSession(null)
  }

  const addCustomCategory = async () => {
    if (!newCategoryName.trim() || !session) return
    const { error } = await supabase.from('categories').insert({
      user_id: session.user.id,
      name: newCategoryName.trim(),
      icon: '📦',
      color: '#888888'
    })
    if (error) {
      alert('Error adding category: ' + error.message)
      return
    }
    trackActivity('category_added', { category_name: newCategoryName.trim() })
    setNewCategoryName('')
    setShowAddCategory(false)
    await loadCategories()
  }

  const addExpense = async (e) => {
    e.preventDefault()
    if (!session) return
    if (!amount || !merchant) {
      setStatus('Please fill required fields.')
      return
    }
    setIsSaving(true)
    setStatus('')
    setSaveSuccess(false)

    let receiptUrl = null
    if (receiptFile) {
      const ext = receiptFile.name.split('.').pop()
      const filename = sanitizeFilename(`${Date.now()}_${merchant}.${ext}`)
      const filePath = `${session.user.id}/${filename}`
      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(filePath, receiptFile)
      if (uploadError) {
        setStatus('Receipt upload failed: ' + uploadError.message)
        setIsSaving(false)
        return
      }
      receiptUrl = filePath
    }

    let location = null
    if (navigator.geolocation) {
      try {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
        })
        location = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          label: await getLocationString(pos.coords.latitude, pos.coords.longitude)
        }
      } catch (err) {
        console.warn('Geolocation failed:', err)
      }
    }

    const tags = parseTags(tagsText)
    const expenseData = {
      user_id: session.user.id,
      amount: parseFloat(amount),
      merchant: merchant.trim(),
      category_id: categoryId || null,
      payment_method: paymentMethod,
      spent_at: new Date(spentAtLocal).toISOString(),
      is_tax_deductible: isTaxDeductible,
      notes: notes.trim() || null,
      receipt_image_url: receiptUrl,
      is_reimbursable: isProMode ? isReimbursable : false,
      employer_or_client: isProMode && isReimbursable ? employerOrClient.trim() || null : null,
      tags: tags.length > 0 ? tags : null,
      location: location ? JSON.stringify(location) : null
    }

    const { error } = await supabase.from('expenses').insert(expenseData)
    setIsSaving(false)
    if (error) {
      setStatus('Error: ' + error.message)
      trackActivity('expense_add_failed', { error: error.message })
      return
    }

    trackActivity('expense_added', { 
      amount: parseFloat(amount), 
      merchant: merchant.trim(),
      has_receipt: !!receiptUrl
    })

    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 2000)
    setAmount('')
    setMerchant('')
    setCategoryId('')
    setPaymentMethod('card')
    setSpentAtLocal(getNowLocalDateTime())
    setIsTaxDeductible(false)
    setNotes('')
    setReceiptFile(null)
    setReceiptUrls([])
    setIsReimbursable(false)
    setEmployerOrClient('')
    setTagsText('')
    setCategoryLearnedSource(null)

    await loadExpenses()
  }

  const updateExpense = async (id, updates) => {
    const { error } = await supabase.from('expenses').update(updates).eq('id', id)
    if (error) {
      alert('Update failed: ' + error.message)
      trackActivity('expense_update_failed', { expense_id: id, error: error.message })
      return
    }
    trackActivity('expense_updated', { expense_id: id, updates: Object.keys(updates) })
    await loadExpenses()
  }

  const setArchivedForExpense = async (id, archived) => {
    await updateExpense(id, { archived })
  }

  const archiveWithUndo = (expense) => {
    setArchivedForExpense(expense.id, true)
    trackActivity('expense_archived', { expense_id: expense.id, merchant: expense.merchant })
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    setUndoBanner(expense)
    undoTimerRef.current = setTimeout(() => {
      setUndoBanner(null)
    }, 5000)
  }

  const deleteExpense = async (id) => {
    if (!window.confirm('Permanently delete this expense?')) return
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) {
      alert('Delete failed: ' + error.message)
      trackActivity('expense_delete_failed', { expense_id: id, error: error.message })
      return
    }
    trackActivity('expense_deleted', { expense_id: id })
    await loadExpenses()
  }

  const openReceipt = async (receiptPath) => {
    if (!receiptPath) return
    trackActivity('receipt_viewed', { receipt_path: receiptPath })
    const { data } = await supabase.storage.from('receipts').createSignedUrl(receiptPath, 60 * 10)
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank')
    }
  }

  const exportCsv = () => {
    trackActivity('csv_exported', { expense_count: expenses.length })
    const header =
      'Date,Merchant,Amount,Category,Payment Method,Tax Deductible,Reimbursable,Employer/Client,Notes,Tags\n'
    const rows = expenses.map((exp) => {
      const cat = categories.find((c) => c.id === exp.category_id)
      return [
        exp.spent_at,
        csvEscape(exp.merchant || ''),
        exp.amount,
        csvEscape(cat?.name || 'Uncategorized'),
        exp.payment_method,
        exp.is_tax_deductible ? 'Yes' : 'No',
        exp.is_reimbursable ? 'Yes' : 'No',
        csvEscape(exp.employer_or_client || ''),
        csvEscape(exp.notes || ''),
        csvEscape((exp.tags || []).join(', '))
      ].join(',')
    })
    const csv = header + rows.join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `expenses_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const runSearch = () => {
    trackActivity('search_performed', { query: search })
    loadExpenses()
  }

  const clearSearch = () => {
    setSearch('')
    setTimeout(() => loadExpenses(), 100)
  }

  const upgradeToPro = () => {
    trackActivity('upgrade_clicked')
    setShowPaywall(true)
  }

  const handleStripeCheckout = async () => {
    trackActivity('stripe_checkout_initiated')
    alert('Stripe checkout not yet wired. Coming soon!')
  }

  const handleAICommand = useCallback(
    async (cmd) => {
      if (cmd.action === 'add_expense') {
        const { merchant: m, amount: a, dateHint, category, notes: aiNotes } = cmd.data
        
        if (!m || !a) {
          alert('Missing merchant or amount for add command')
          return
        }

        let spentAt = new Date()
        if (dateHint) {
          const parsed = parseNaturalDate(dateHint)
          if (parsed) spentAt = parsed
        }

        let categoryIdToUse = category || null
        if (m && !categoryIdToUse) {
          const suggested = suggestCategoryForMerchant(m)
          if (suggested) categoryIdToUse = suggested
        }

        const expenseData = {
          user_id: session.user.id,
          amount: parseFloat(a),
          merchant: m.trim(),
          category_id: categoryIdToUse,
          payment_method: 'card',
          spent_at: spentAt.toISOString(),
          is_tax_deductible: false,
          notes: aiNotes || null,
          archived: false
        }

        console.log('💾 Adding expense via AI:', expenseData)

        const { error } = await supabase.from('expenses').insert(expenseData)
        
        if (error) {
          console.error('❌ Add failed:', error)
          alert('Failed to add expense: ' + error.message)
          trackActivity('ai_add_failed', { error: error.message })
          return
        }

        console.log('✅ Expense added successfully')
        trackActivity('ai_add_success', { merchant: m, amount: a })
        await loadExpenses()
        
      } else if (cmd.action === 'update_expense') {
        const { query, updates } = cmd.data
        const currentExpenses = allExpensesRef.current

        console.log('🔍 Searching for expense:', query)
        console.log('📊 Available expenses:', currentExpenses.length)

        let targetExpense = null

        if (query === 'most_recent') {
          targetExpense = currentExpenses[0]
          console.log('✅ Found most recent:', targetExpense)
        } else {
          const lowerQuery = query.toLowerCase()
          
          targetExpense = currentExpenses.find(exp =>
            exp.merchant.toLowerCase() === lowerQuery
          )

          if (!targetExpense) {
            targetExpense = currentExpenses.find(exp =>
              exp.merchant.toLowerCase().includes(lowerQuery)
            )
          }

          if (!targetExpense) {
            const queryAmount = parseFloat(query)
            if (!isNaN(queryAmount)) {
              targetExpense = currentExpenses.find(exp =>
                Math.abs(parseFloat(exp.amount) - queryAmount) < 0.01
              )
            }
          }

          if (!targetExpense) {
            const dateMatch = query.match(/(\d{1,2})\/(\d{1,2})/)
            if (dateMatch) {
              const month = parseInt(dateMatch[1])
              const day = parseInt(dateMatch[2])
              
              targetExpense = currentExpenses.find(exp => {
                const expDate = new Date(exp.spent_at)
                return expDate.getMonth() + 1 === month && expDate.getDate() === day
              })
            }
          }

          if (targetExpense) {
            console.log('✅ Found expense:', targetExpense.merchant, targetExpense.amount)
          } else {
            console.log('❌ No match found for query:', query)
            console.log('📋 First 5 merchants:', currentExpenses.slice(0, 5).map(e => e.merchant))
          }
        }

        if (targetExpense) {
          console.log('🚀 Updating expense:', targetExpense.id, updates)
          trackActivity('ai_update_success', { query, updates: Object.keys(updates) })
          await updateExpense(targetExpense.id, updates)
        } else {
          trackActivity('ai_update_failed', { query, reason: 'expense_not_found' })
          alert(`Could not find that expense. Searched for: "${query}"`)
        }
      } else if (cmd.action === 'search') {
        setSearch(cmd.data.query || '')
        trackActivity('ai_search', { query: cmd.data.query })
        setTimeout(() => loadExpenses(), 100)
      } else if (cmd.action === 'export') {
        trackActivity('ai_export')
        exportCsv()
      }
    },
    [session, loadExpenses, suggestCategoryForMerchant, trackActivity]
  )

  const handleTransactionsParsed = (transactions, fileName) => {
    console.log('📦 Received parsed transactions:', transactions.length, 'from', fileName)
    trackActivity('import_parsed', { transaction_count: transactions.length, file_name: fileName })
    setImportedTransactions(transactions)
  }

  const handleImport = async (selectedTransactions) => {
    const expensesToInsert = selectedTransactions.map(txn => ({
      user_id: session.user.id,
      amount: txn.amount,
      merchant: txn.merchant,
      category_id: txn.category || null,
      spent_at: txn.date,
      notes: txn.notes || null,
      payment_method: 'card',
      is_tax_deductible: false,
      archived: false
    }))

    const { error } = await supabase.from('expenses').insert(expensesToInsert)
    
    if (error) {
      alert('Import failed: ' + error.message)
      trackActivity('import_failed', { error: error.message })
      return
    }

    trackActivity('import_success', { transaction_count: selectedTransactions.length })
    alert(`✅ Successfully imported ${selectedTransactions.length} expenses!`)
    setImportedTransactions([])
    setShowImport(false)
    await loadExpenses()
  }

  const handleCancelImport = () => {
    trackActivity('import_cancelled')
    setImportedTransactions([])
    setShowImport(false)
  }

  const filteredExpenses = useMemo(() => {
    return expenses
  }, [expenses])

  if (!session) {
    return <Login onLogin={login} />
  }

  if (showLoginHistory && isAdmin) {
    return <LoginHistory onBack={() => setShowLoginHistory(false)} />
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif', maxWidth: 1400 }}>
      {showPaywall && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
          }}
          onClick={() => setShowPaywall(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 40,
              maxWidth: 500,
              textAlign: 'center'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0 }}>🚀 Upgrade to PRO</h2>
            <p style={{ fontSize: 18, color: '#555' }}>
              Unlock advanced features, AI insights, and unlimited tracking.
            </p>
            <p style={{ fontSize: 32, fontWeight: 'bold', margin: '20px 0' }}>$5/month</p>
            <button
              onClick={handleStripeCheckout}
              style={{
                padding: '14px 32px',
                fontSize: 16,
                fontWeight: 'bold',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer'
              }}
            >
              Subscribe Now
            </button>
            <p style={{ marginTop: 20, fontSize: 12, color: '#999' }}>Cancel anytime.</p>
          </div>
        </div>
      )}

      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 30
        }}
      >
        <h1 style={{ margin: 0 }}>💰 Spender Tracker</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
          {isAdmin && (
            <button
              onClick={() => setShowLoginHistory(true)}
              style={{
                padding: '8px 16px',
                background: '#ff9800',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              🔐 Login History
            </button>
          )}
          <button
            onClick={() => setShowImport(!showImport)}
            style={{
              padding: '8px 16px',
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            📥 Import
          </button>
          {isProMode ? (
            <span
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: '#fff',
                padding: '6px 14px',
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 'bold'
              }}
            >
              ⭐ PRO
            </span>
          ) : (
            <button
              onClick={upgradeToPro}
              style={{
                padding: '8px 16px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Upgrade to PRO
            </button>
          )}
          <button
            onClick={logout}
            style={{
              padding: '8px 16px',
              background: '#f44336',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer'
            }}
          >
            Logout
          </button>
        </div>
      </header>

      {undoBanner && (
        <div
          style={{
            background: '#ffeb3b',
            padding: 12,
            borderRadius: 8,
            marginBottom: 20,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <span>
            Archived: <strong>{undoBanner.merchant}</strong> (${undoBanner.amount})
          </span>
          <button
            onClick={() => {
              setArchivedForExpense(undoBanner.id, false)
              setUndoBanner(null)
              if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
              trackActivity('expense_unarchived', { expense_id: undoBanner.id })
            }}
            style={{
              padding: '6px 12px',
              background: '#4caf50',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer'
            }}
          >
            Undo
          </button>
        </div>
      )}

      {isProMode && aiInsights && (
        <div
          style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: '#fff',
            padding: 20,
            borderRadius: 12,
            marginBottom: 30
          }}
        >
          <h3 style={{ marginTop: 0 }}>🤖 AI Insights (PRO)</h3>
          <p>
            <strong>Month-End Forecast:</strong> ${aiInsights.forecastTotal}
          </p>
          {aiInsights.recurringExpenses.length > 0 && (
            <div>
              <strong>Recurring Expenses:</strong>
              <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
                {aiInsights.recurringExpenses.map((r, i) => (
                  <li key={i}>
                    {r.merchant} ({r.count}x)
                  </li>
                ))}
              </ul>
            </div>
          )}
          {aiInsights.categorySpending.length > 0 && (
            <div>
              <strong>Top Categories This Month:</strong>
              <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
                {aiInsights.categorySpending.slice(0, 3).map((c, i) => (
                  <li key={i}>
                    {c.icon} {c.name}: ${c.total.toFixed(2)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <ChatAssistant
        expenses={allExpenses}
        categories={categories}
        isProMode={isProMode}
        onUpgradeToPro={upgradeToPro}
        onAICommand={handleAICommand}
        userId={session?.user?.id}
        notifications={notifications}
        onDismissNotification={dismissNotification}
      />

      {showImport && importedTransactions.length === 0 && (
        <FileImport onTransactionsParsed={handleTransactionsParsed} />
      )}

      {importedTransactions.length > 0 && (
        <ImportPreview
          transactions={importedTransactions}
          categories={categories}
          onImport={handleImport}
          onCancel={handleCancelImport}
        />
      )}

      <AddExpenseForm
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
        notes={notes}
        setNotes={setNotes}
        isTaxDeductible={isTaxDeductible}
        setIsTaxDeductible={setIsTaxDeductible}
        receiptFile={receiptFile}
        setReceiptFile={setReceiptFile}
        receiptUrls={receiptUrls}
        setReceiptUrls={setReceiptUrls}
        isReimbursable={isReimbursable}
        setIsReimbursable={setIsReimbursable}
        employerOrClient={employerOrClient}
        setEmployerOrClient={setEmployerOrClient}
        tagsText={tagsText}
        setTagsText={setTagsText}
        categories={categories}
        isProMode={isProMode}
        showMoreOptions={showMoreOptions}
        setShowMoreOptions={setShowMoreOptions}
        onSubmit={addExpense}
        isSaving={isSaving}
        saveSuccess={saveSuccess}
        status={status}
        categoryLearnedSource={categoryLearnedSource}
        showAddCategory={showAddCategory}
        setShowAddCategory={setShowAddCategory}
        newCategoryName={newCategoryName}
        setNewCategoryName={setNewCategoryName}
        addCustomCategory={addCustomCategory}
        isProcessingReceipt={isProcessingReceipt}
        processReceiptWithOCR={processReceiptWithOCR}
      />

      <ExpenseList
        expenses={filteredExpenses}
        categories={categories}
        onUpdate={updateExpense}
        onArchive={archiveWithUndo}
        onDelete={deleteExpense}
        onOpenReceipt={openReceipt}
        showArchived={showArchived}
        setShowArchived={setShowArchived}
        search={search}
        setSearch={setSearch}
        runSearch={runSearch}
        clearSearch={clearSearch}
        exportCsv={exportCsv}
        isProMode={isProMode}
      />

      <MonthlySummary expenses={expenses} categories={categories} />
    </div>
  )
}

export default App

function parseNaturalDate(hint) {
  const lower = hint.toLowerCase()
  const now = new Date()
  if (lower.includes('today')) return now
  if (lower.includes('yesterday')) {
    const d = new Date(now)
    d.setDate(d.getDate() - 1)
    return d
  }
  const match = lower.match(/(\d+)\s*(day|week|month)s?\s*ago/)
  if (match) {
    const val = parseInt(match[1], 10)
    const unit = match[2]
    const d = new Date(now)
    if (unit === 'day') d.setDate(d.getDate() - val)
    else if (unit === 'week') d.setDate(d.getDate() - val * 7)
    else if (unit === 'month') d.setMonth(d.getMonth() - val)
    return d
  }
  return null
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function csvEscape(str) {
  if (!str) return ''
  return `"${str.replace(/"/g, '""')}"`
}

function escapeIlike(str) {
  return `%${str.replace(/%/g, '\\%').replace(/_/g, '\\_')}%`
}

function pickCategoryIdFromMerchant(merchant, categories) {
  const lower = merchant.toLowerCase()
  if (lower.includes('coffee') || lower.includes('starbucks')) {
    return categories.find((c) => c.name.toLowerCase().includes('coffee'))?.id
  }
  if (lower.includes('gas') || lower.includes('shell')) {
    return categories.find((c) => c.name.toLowerCase().includes('gas'))?.id
  }
  return null
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

function parseTags(text) {
  if (!text) return []
  return text
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
}

function getNowLocalDateTime() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60000
  const localISOTime = new Date(now - offset).toISOString().slice(0, 16)
  return localISOTime
}

async function getLocationString(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
    )
    const data = await res.json()
    return data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`
  } catch (err) {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
  }
}