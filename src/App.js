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
import AnalyticsDashboard from './components/AnalyticsDashboard'

import { ProactiveEngine } from './lib/ProactiveEngine'
import { PatternAnalyzer } from './lib/PatternAnalyzer'
import { PredictiveEngine } from './lib/PredictiveEngine'

function App() {
  const [session, setSession] = useState(null)
  const [subscriptionStatus, setSubscriptionStatus] = useState('free')
  const [showPaywall, setShowPaywall] = useState(false)
  const [userRole, setUserRole] = useState('user')
  const [userName, setUserName] = useState('')
  const [userTitle, setUserTitle] = useState('')
  const [showLoginHistory, setShowLoginHistory] = useState(false)
  const [showAnalytics, setShowAnalytics] = useState(false)

  const [categories, setCategories] = useState([])
  const [expenses, setExpenses] = useState([])
  const [allExpenses, setAllExpenses] = useState([])

  const [amount, setAmount] = useState('')
  const [merchant, setMerchant] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('credit_card')
  const [spentAtLocal, setSpentAtLocal] = useState(getNowLocalDateTime())
  const [status, setStatus] = useState('settled')
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const [showMoreOptions, setShowMoreOptions] = useState(false)
  const [isTaxDeductible, setIsTaxDeductible] = useState(false)
  const [notes, setNotes] = useState('')

 const isProMode = useMemo(() => subscriptionStatus === 'pro', [subscriptionStatus])

  const isAdmin = useMemo(() => userRole === 'admin', [userRole])

  const [isReimbursable, setIsReimbursable] = useState(false)
  const [employerOrClient, setEmployerOrClient] = useState('')
  const [tagsText, setTagsText] = useState('')

  const [budgets, setBudgets] = useState([])
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

  const [showImport, setShowImport] = useState(false)
  const [importedTransactions, setImportedTransactions] = useState([])

  const [notifications, setNotifications] = useState([])

  const allExpensesRef = useRef(allExpenses)
  const sessionIdRef = useRef(null)
  const activityTimerRef = useRef(null)
  const merchantMemoryRef = useRef({})

  const currentPageRef = useRef('dashboard')
  const pageStartTimeRef = useRef(Date.now())
  const lastActivityRef = useRef(Date.now())
  const idleTimerRef = useRef(null)

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

  useEffect(() => {
    if (!session?.user) return

    const userId = session.user.id
    const email = session.user.email

    ;(async () => {
      const deviceInfo = {
        platform: navigator.platform,
        user_agent: navigator.userAgent,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language
      }

      await supabase.from('login_logs').insert({
        user_id: userId,
        email,
        device_info: deviceInfo,
        logged_in_at: new Date().toISOString()
      })

      console.log('📝 Login tracked:', email)

      const { data: existingSession } = await supabase
        .from('user_sessions')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle()

      if (existingSession) {
        sessionIdRef.current = existingSession.id
        console.log('🔄 Continuing existing session:', existingSession.id)
        await supabase
          .from('user_sessions')
          .update({ last_activity: new Date().toISOString() })
          .eq('id', existingSession.id)
      } else {
        const { data: newSession } = await supabase
          .from('user_sessions')
          .insert({
            user_id: userId,
            email,
            session_start: new Date().toISOString(),
            device_info: deviceInfo,
            last_activity: new Date().toISOString(),
            is_active: true
          })
          .select('id')
          .single()

        if (newSession) {
          sessionIdRef.current = newSession.id
          console.log('⏱️ New session started:', newSession.id)
        }
      }

      activityTimerRef.current = setInterval(async () => {
        if (sessionIdRef.current) {
          await supabase
            .from('user_sessions')
            .update({ last_activity: new Date().toISOString() })
            .eq('id', sessionIdRef.current)
        }
      }, 30000)

      const handleBeforeUnload = async () => {
        if (sessionIdRef.current) {
          const { data: sess } = await supabase
            .from('user_sessions')
            .select('session_start')
            .eq('id', sessionIdRef.current)
            .maybeSingle()

          if (sess) {
            const start = new Date(sess.session_start)
            const end = new Date()
            const duration = Math.floor((end - start) / 1000)

            await supabase
              .from('user_sessions')
              .update({
                session_end: end.toISOString(),
                duration_seconds: duration,
                is_active: false
              })
              .eq('id', sessionIdRef.current)
          }
        }
      }

      window.addEventListener('beforeunload', handleBeforeUnload)

      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload)
        if (activityTimerRef.current) {
          clearInterval(activityTimerRef.current)
        }
      }
    })()
  }, [session])

  const trackPageView = useCallback(
    async (pageName) => {
      if (!session?.user || !sessionIdRef.current) return

      const prevPage = currentPageRef.current
      const prevStart = pageStartTimeRef.current
      const now = Date.now()

      if (prevStart) {
        const duration = Math.floor((now - prevStart) / 1000)
        await supabase
          .from('page_views')
          .update({ duration_seconds: duration })
          .eq('session_id', sessionIdRef.current)
          .eq('page_name', prevPage)
          .is('duration_seconds', null)
      }

      const deviceInfo = {
        platform: navigator.platform,
        user_agent: navigator.userAgent,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }

      await supabase.from('page_views').insert({
        user_id: session.user.id,
        email: session.user.email,
        page_name: pageName,
        page_url: window.location.href,
        session_id: sessionIdRef.current,
        device_info: deviceInfo,
        viewed_at: new Date().toISOString()
      })

      currentPageRef.current = pageName
      pageStartTimeRef.current = now
    },
    [session]
  )

  const trackActivity = useCallback(
    async (activityType, activityData = {}) => {
      if (!session?.user || !sessionIdRef.current) return

      await supabase.from('user_activities').insert({
        user_id: session.user.id,
        email: session.user.email,
        session_id: sessionIdRef.current,
        activity_type: activityType,
        activity_data: activityData,
        page_name: currentPageRef.current,
        created_at: new Date().toISOString()
      })
    },
    [session]
  )

  const updateIdleStatus = useCallback(() => {
    const now = Date.now()
    const idleThreshold = 2 * 60 * 1000

    if (now - lastActivityRef.current > idleThreshold) {
      trackActivity('idle_detected')
    }

    lastActivityRef.current = now
  }, [trackActivity])

  useEffect(() => {
    const handleActivity = () => {
      updateIdleStatus()
    }

    window.addEventListener('mousemove', handleActivity)
    window.addEventListener('keydown', handleActivity)
    window.addEventListener('click', handleActivity)
    window.addEventListener('scroll', handleActivity)

    idleTimerRef.current = setInterval(() => {
      updateIdleStatus()
    }, 60000)

    return () => {
      window.removeEventListener('mousemove', handleActivity)
      window.removeEventListener('keydown', handleActivity)
      window.removeEventListener('click', handleActivity)
      window.removeEventListener('scroll', handleActivity)
      if (idleTimerRef.current) {
        clearInterval(idleTimerRef.current)
      }
    }
  }, [updateIdleStatus])

  useEffect(() => {
    if (!session) return

    if (showLoginHistory) {
      trackPageView('login_history')
    } else if (showAnalytics) {
      trackPageView('analytics')
    } else if (showImport) {
      trackPageView('import')
    } else if (importedTransactions.length > 0) {
      trackPageView('import_preview')
    } else {
      trackPageView('dashboard')
    }
  }, [session, showLoginHistory, showAnalytics, showImport, importedTransactions, trackPageView])

  useEffect(() => {
    if (session) {
      loadUserRole()
      loadUserProfile()
    }
  }, [session])

  useEffect(() => {
    if (session) {
      loadSubscription()
      loadCategories()
      loadExpenses()
    }
  }, [session])

  async function loadUserRole() {
    const { data } = await supabase
      .from('user_preferences')
      .select('preference_value')
      .eq('user_id', session.user.id)
      .eq('preference_type', 'role')
      .maybeSingle()

    const role = data?.preference_value || 'user'
    setUserRole(role)
    console.log('👤 User role:', role)
  }

  async function loadUserProfile() {
    const { data: nameData } = await supabase
      .from('user_preferences')
      .select('preference_value')
      .eq('user_id', session.user.id)
      .eq('preference_type', 'display_name')
      .maybeSingle()

    const { data: titleData } = await supabase
      .from('user_preferences')
      .select('preference_value')
      .eq('user_id', session.user.id)
      .eq('preference_type', 'title')
      .maybeSingle()

    setUserName(nameData?.preference_value || session.user.email.split('@')[0])
    setUserTitle(titleData?.preference_value || '')
  }

  async function loadSubscription() {
    const { data } = await supabase
      .from('subscriptions')
      .select('status')
      .eq('user_id', session.user.id)
      .maybeSingle()
    if (data) {
      setSubscriptionStatus(data.status)
    }
  }

  async function loadCategories() {
    const { data } = await supabase
      .from('categories')
      .select('id, name, icon, color')
      .order('name')
    setCategories(data || [])
  }

  async function loadExpenses() {
    let query = supabase
      .from('expenses')
      .select(
        'id, user_id, category_id, merchant, amount, payment_method, spent_at, created_at, status, notes, is_tax_deductible, is_reimbursable, employer_or_client, tags, location, receipt_image_url, archived'
      )
      .eq('user_id', session.user.id)

    if (!showArchived) {
      query = query.or('archived.is.null,archived.eq.false')
    }

    if (search) {
      query = query.or(
        `merchant.ilike.${escapeIlike(search)},notes.ilike.${escapeIlike(search)},tags.cs.{${search}}`
      )
    }

    query = query.order('spent_at', { ascending: false }).limit(100)

    const { data, error } = await query
    if (error) {
      console.error('Failed to load expenses:', error)
    } else {
      setExpenses(data || [])
    }

    const { data: allData } = await supabase
      .from('expenses')
      .select('id, merchant, amount, category_id, spent_at, status, notes, is_tax_deductible, tags, receipt_image_url')
      .eq('user_id', session.user.id)
      .order('spent_at', { ascending: false })

    setAllExpenses(allData || [])

    const memoryMap = {}
    if (allData) {
      for (const exp of allData) {
        if (exp.merchant && exp.category_id) {
          memoryMap[exp.merchant.toLowerCase()] = exp.category_id
        }
      }
    }
    merchantMemoryRef.current = memoryMap
  }

  function escapeIlike(str) {
    return '%' + str.replace(/%/g, '\\%').replace(/_/g, '\\_') + '%'
  }

  useEffect(() => {
    if (isProMode && allExpenses.length && categories.length) {
      calculateAIInsights()
    }
  }, [isProMode, allExpenses, categories])

  function calculateAIInsights() {
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()

    const thisMonthExpenses = allExpenses.filter((e) => {
      const d = new Date(e.spent_at)
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear
    })

    const total = thisMonthExpenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0)
    const dayOfMonth = now.getDate()
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
    const forecastTotal = (total / dayOfMonth) * daysInMonth

    const merchantCounts = {}
    for (const exp of thisMonthExpenses) {
      const m = (exp.merchant || 'Unknown').toLowerCase()
      merchantCounts[m] = (merchantCounts[m] || 0) + 1
    }
    const recurringExpenses = Object.keys(merchantCounts).filter((k) => merchantCounts[k] >= 2)

    const catSpend = {}
    for (const exp of thisMonthExpenses) {
      const cid = exp.category_id
      catSpend[cid] = (catSpend[cid] || 0) + parseFloat(exp.amount || 0)
    }
    const categorySpending = categories
      .map((cat) => ({
        ...cat,
        spent: catSpend[cat.id] || 0
      }))
      .filter((c) => c.spent > 0)
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 5)

    setAiInsights({
      forecastTotal,
      recurringExpenses,
      categorySpending
    })
  }

  useEffect(() => {
    if (!isProMode || !session) return

    let isMounted = true

    async function fetchAndGenerate() {
      if (!isMounted) return
      try {
        const existing = await ProactiveEngine.fetchNotifications(session.user.id)
        if (isMounted) setNotifications(existing)

        const generated = await ProactiveEngine.generateNotifications(
          session.user.id,
          allExpenses,
          categories,
          budgets
        )
        if (isMounted) setNotifications((prev) => [...prev, ...generated])
      } catch (err) {
        console.error('Notification error:', err)
      }
    }

    fetchAndGenerate()

    const interval = setInterval(() => {
      if (isMounted) fetchAndGenerate()
    }, 5 * 60 * 1000)

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [isProMode, session, allExpenses, categories, budgets])

  async function handleAICommand(command) {
    trackActivity('ai_command_used', { command })

    if (command.action === 'add_expense') {
      try {
        const amtNum = parseFloat(command.amount || 0)
        if (isNaN(amtNum) || amtNum <= 0) {
          return { success: false, message: 'Invalid amount' }
        }

        let dateStr = new Date().toISOString()
        if (command.dateHint) {
          const parsed = parseNaturalDate(command.dateHint)
          if (parsed) dateStr = parsed
        }

        let finalCat = command.category_id
        if (!finalCat && command.merchant) {
          finalCat = await suggestCategoryForMerchant(command.merchant)
        }
        if (!finalCat && categories.length) {
          finalCat = categories[0].id
        }

        const { error } = await supabase.from('expenses').insert({
          user_id: session.user.id,
          merchant: command.merchant || 'Unnamed',
          amount: amtNum,
          category_id: finalCat,
          payment_method: command.payment_method || 'credit_card',
          spent_at: dateStr,
          status: 'settled'
        })

        if (error) throw error

        await loadExpenses()
        await trackActivity('expense_added', { merchant: command.merchant, amount: amtNum })
        return { success: true, message: 'Expense added!' }
      } catch (err) {
        console.error('AI add failed:', err)
        await trackActivity('ai_add_failed')
        return { success: false, message: 'Failed to add expense' }
      }
    }

    if (command.action === 'update_expense') {
      const all = allExpensesRef.current
      let target = all.find((e) => e.id === command.id)
      if (!target && command.merchant) {
        target = all.find(
          (e) => e.merchant && e.merchant.toLowerCase().includes(command.merchant.toLowerCase())
        )
      }
      if (!target) {
        target = all[0]
      }

      if (target) {
        const updated = { ...target }
        if (command.merchant) updated.merchant = command.merchant
        if (command.amount !== undefined) updated.amount = parseFloat(command.amount)
        if (command.category_id) updated.category_id = command.category_id
        if (command.notes !== undefined) updated.notes = command.notes

        const { error } = await supabase.from('expenses').update(updated).eq('id', target.id)
        if (!error) {
          await loadExpenses()
          await trackActivity('ai_update_success')
          return { success: true, message: 'Expense updated!' }
        }
      }
      return { success: false, message: 'Could not find expense to update' }
    }

    if (command.action === 'search') {
      setSearch(command.query || '')
      await trackActivity('search_performed', { query: command.query })
      return { success: true, message: `Searching for: ${command.query}` }
    }

    if (command.action === 'export') {
      exportCsv()
      return { success: true, message: 'Exporting expenses as CSV...' }
    }

    return { success: false, message: 'Unknown command' }
  }

  async function suggestCategoryForMerchant(merchantName) {
    const lower = merchantName.toLowerCase()
    const memory = merchantMemoryRef.current
    if (memory[lower]) return memory[lower]

    if (!categories.length) return null

    const prompt = `User bought from "${merchantName}". Available categories: ${categories.map((c) => c.name).join(', ')}. Which category fits best? Reply ONLY with the category name.`

    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3
        })
      })
      const json = await res.json()
      const suggestion = json.choices[0]?.message?.content?.trim()
      const match = categories.find(
        (c) => c.name.toLowerCase() === suggestion?.toLowerCase()
      )
      return match ? match.id : categories[0].id
    } catch (err) {
      console.error('AI category suggestion failed:', err)
      return categories[0].id
    }
  }

  function parseNaturalDate(hint) {
    const lower = hint.toLowerCase()
    const now = new Date()

    if (lower.includes('yesterday')) {
      const d = new Date(now)
      d.setDate(d.getDate() - 1)
      return d.toISOString()
    }
    if (lower.match(/\d+ days? ago/)) {
      const match = lower.match(/(\d+) days? ago/)
      if (match) {
        const days = parseInt(match[1], 10)
        const d = new Date(now)
        d.setDate(d.getDate() - days)
        return d.toISOString()
      }
    }
    if (lower.includes('last week')) {
      const d = new Date(now)
      d.setDate(d.getDate() - 7)
      return d.toISOString()
    }

    return null
  }

  async function processReceiptWithOCR() {
    if (!receiptFile) return

    setIsProcessingReceipt(true)
    await trackActivity('receipt_scan_started')

    try {
      const base64 = await fileToBase64(receiptFile)
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Extract merchant name, amount, date, and itemized list from this receipt. Return JSON only: {"merchant": "...", "amount": 0.00, "date": "YYYY-MM-DD", "items": ["item1", "item2"]}'
                },
                {
                  type: 'image_url',
                  image_url: { url: base64 }
                }
              ]
            }
          ],
          max_tokens: 500
        })
      })
      const json = await res.json()
      const content = json.choices[0]?.message?.content || '{}'
      const parsed = JSON.parse(content)

      setMerchant(parsed.merchant || '')
      setAmount(parsed.amount ? String(parsed.amount) : '')
      if (parsed.date) {
        setSpentAtLocal(parsed.date + 'T12:00')
      }
      if (parsed.items && parsed.items.length) {
        setNotes('Items: ' + parsed.items.join(', '))
      }

      await trackActivity('receipt_scan_success', { merchant: parsed.merchant })
    } catch (err) {
      console.error('OCR failed:', err)
      alert('Failed to process receipt')
      await trackActivity('receipt_scan_failed')
    } finally {
      setIsProcessingReceipt(false)
    }
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  async function addExpense() {
    if (!amount || !merchant || !categoryId) {
      alert('Amount, Merchant, and Category are required.')
      return
    }

    setIsSaving(true)
    setSaveSuccess(false)

    try {
      let receiptImageUrl = null

      if (receiptFile) {
        const fileName = `${session.user.id}/${Date.now()}_${sanitizeFilename(receiptFile.name)}`
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(fileName, receiptFile)

        if (uploadError) throw uploadError

        receiptImageUrl = uploadData.path
      }

      let locationString = null
      if (navigator.geolocation) {
        try {
          const pos = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject)
          })
          const { latitude, longitude } = pos.coords
          locationString = await getLocationString(latitude, longitude)
        } catch (err) {
          console.warn('Geolocation failed:', err)
        }
      }

      const tags = parseTags(tagsText)

      const { error } = await supabase.from('expenses').insert({
        user_id: session.user.id,
        category_id: categoryId,
        merchant,
        amount: parseFloat(amount),
        payment_method: paymentMethod,
        spent_at: new Date(spentAtLocal).toISOString(),
        status,
        notes,
        is_tax_deductible: isTaxDeductible,
        is_reimbursable: isReimbursable,
        employer_or_client: employerOrClient || null,
        tags,
        location: locationString,
        receipt_image_url: receiptImageUrl
      })

      if (error) throw error

      setSaveSuccess(true)
      await trackActivity('expense_added', { merchant, amount: parseFloat(amount) })

      setTimeout(() => setSaveSuccess(false), 2000)

      setAmount('')
      setMerchant('')
      setCategoryId('')
      setPaymentMethod('credit_card')
      setSpentAtLocal(getNowLocalDateTime())
      setStatus('settled')
      setNotes('')
      setIsTaxDeductible(false)
      setIsReimbursable(false)
      setEmployerOrClient('')
      setTagsText('')
      setReceiptFile(null)
      setReceiptUrls([])

      await loadExpenses()
    } catch (err) {
      console.error('Failed to add expense:', err)
      alert('Failed to add expense')
      await trackActivity('expense_add_failed')
    } finally {
      setIsSaving(false)
    }
  }

  function parseTags(text) {
    if (!text) return []
    return text
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t)
  }

  async function getLocationString(lat, lon) {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
      )
      const json = await res.json()
      return json.display_name || `${lat},${lon}`
    } catch (err) {
      console.warn('Reverse geocode failed:', err)
      return `${lat},${lon}`
    }
  }

  function sanitizeFilename(name) {
    return name.replace(/[^a-zA-Z0-9._-]/g, '_')
  }

  function getNowLocalDateTime() {
    const now = new Date()
    const offset = now.getTimezoneOffset() * 60000
    const localISO = new Date(now - offset).toISOString().slice(0, 16)
    return localISO
  }

  async function updateExpense(id, updates) {
    const { error } = await supabase.from('expenses').update(updates).eq('id', id)
    if (!error) {
      await loadExpenses()
      await trackActivity('expense_updated', { id, updates })
    }
  }

  async function setArchivedForExpense(id, archived) {
    await updateExpense(id, { archived })
    await trackActivity('expense_archived', { id, archived })
  }

  function archiveWithUndo(id) {
    setArchivedForExpense(id, true)
    setUndoBanner({
      id,
      message: 'Expense archived',
      undo: () => {
        setArchivedForExpense(id, false)
        setUndoBanner(null)
      }
    })
    setTimeout(() => setUndoBanner(null), 5000)
  }

  async function deleteExpense(id) {
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (!error) {
      await loadExpenses()
      await trackActivity('expense_deleted', { id })
    }
  }

  async function openReceipt(receiptPath) {
    const { data } = await supabase.storage.from('receipts').createSignedUrl(receiptPath, 60 * 10)
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank')
    }
  }

  function exportCsv() {
    if (!expenses.length) {
      alert('No expenses to export')
      return
    }

    const headers = [
      'Date',
      'Merchant',
      'Amount',
      'Category',
      'Payment Method',
      'Status',
      'Notes',
      'Tax Deductible',
      'Reimbursable',
      'Employer/Client',
      'Tags',
      'Location'
    ]

    const rows = expenses.map((exp) => {
      const cat = categories.find((c) => c.id === exp.category_id)
      return [
        exp.spent_at,
        csvEscape(exp.merchant),
        exp.amount,
        csvEscape(cat?.name || ''),
        exp.payment_method,
        exp.status,
        csvEscape(exp.notes),
        exp.is_tax_deductible ? 'Yes' : 'No',
        exp.is_reimbursable ? 'Yes' : 'No',
        csvEscape(exp.employer_or_client),
        csvEscape((exp.tags || []).join(', ')),
        csvEscape(exp.location)
      ]
    })

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', 'expenses.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    trackActivity('csv_exported')
  }

  function csvEscape(val) {
    if (!val) return ''
    const str = String(val)
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return '"' + str.replace(/"/g, '""') + '"'
    }
    return str
  }

  async function addCategory() {
    if (!newCategoryName.trim()) {
      alert('Category name is required')
      return
    }

    const { error } = await supabase.from('categories').insert({
      name: newCategoryName.trim(),
      icon: '📂',
      color: '#3b82f6'
    })

    if (!error) {
      setNewCategoryName('')
      setShowAddCategory(false)
      await loadCategories()
      await trackActivity('category_added', { name: newCategoryName })
    }
  }

  function handleTransactionsParsed(transactions) {
    setImportedTransactions(transactions)
    setShowImport(false)
  }

  async function handleImport(finalTransactions) {
    const toInsert = finalTransactions.map((t) => ({
      user_id: session.user.id,
      category_id: t.category_id,
      merchant: t.merchant,
      amount: parseFloat(t.amount),
      payment_method: t.payment_method || 'credit_card',
      spent_at: t.spent_at,
      status: t.status || 'settled',
      notes: t.notes || ''
    }))

    const { error } = await supabase.from('expenses').insert(toInsert)
    if (error) {
      console.error('Import failed:', error)
      alert('Import failed')
      await trackActivity('import_failed')
    } else {
      alert('Import successful!')
      await trackActivity('import_success', { count: toInsert.length })
      await loadExpenses()
      setImportedTransactions([])
    }
  }

  function handleCancelImport() {
    setImportedTransactions([])
  }

  useEffect(() => {
    if (receiptFile) {
      const objectUrl = URL.createObjectURL(receiptFile)
      setReceiptUrls([objectUrl])
      return () => URL.revokeObjectURL(objectUrl)
    } else {
      setReceiptUrls([])
    }
  }, [receiptFile])

  async function handleLogout() {
    await trackActivity('logout')
    await supabase.auth.signOut()
  }

  if (!session) {
    return <Login />
  }

  if (showLoginHistory) {
    return <LoginHistory onBack={() => setShowLoginHistory(false)} />
  }

  if (showAnalytics) {
    return <AnalyticsDashboard onBack={() => setShowAnalytics(false)} />
  }

  if (showImport) {
    return (
      <FileImport
        categories={categories}
        onTransactionsParsed={handleTransactionsParsed}
        onClose={() => setShowImport(false)}
      />
    )
  }

  if (importedTransactions.length > 0) {
    return (
      <ImportPreview
        transactions={importedTransactions}
        categories={categories}
        onConfirm={handleImport}
        onCancel={handleCancelImport}
      />
    )
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 20, fontFamily: 'sans-serif' }}>
      {showPaywall && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
          }}
        >
          <div
            style={{
              background: '#fff',
              padding: 30,
              borderRadius: 8,
              maxWidth: 400,
              textAlign: 'center'
            }}
          >
            <h2>✨ Upgrade to PRO</h2>
            <p>Unlock advanced AI features, analytics, and unlimited expenses.</p>
            <button
              onClick={() => {
                trackActivity('upgrade_clicked')
                alert('Redirecting to Stripe checkout...')
              }}
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: '#fff',
                border: 'none',
                padding: '12px 24px',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 16,
                marginRight: 10
              }}
            >
              Upgrade Now
            </button>
            <button
              onClick={() => setShowPaywall(false)}
              style={{
                background: '#eee',
                border: 'none',
                padding: '12px 24px',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 16
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <header style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>💰 Nova Expense Tracker</h1>
        
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 'bold', color: '#333' }}>
            Hello {userName}
          </div>
          {userTitle && (
            <div style={{ fontSize: 14, color: '#666', marginTop: 4 }}>
              {userTitle}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          {isAdmin && (
            <>
              <button
                onClick={() => {
                  setShowLoginHistory(true)
                  setShowAnalytics(false)
                }}
                style={{
                  background: '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: 8,
                  cursor: 'pointer'
                }}
              >
                🔐 Login History
              </button>
              <button
                onClick={() => {
                  setShowAnalytics(true)
                  setShowLoginHistory(false)
                }}
                style={{
                  background: '#10b981',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: 8,
                  cursor: 'pointer'
                }}
              >
                📊 Analytics
              </button>
            </>
          )}
          <button
            onClick={() => setShowImport(true)}
            style={{
              background: '#10b981',
              color: '#fff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: 8,
              cursor: 'pointer'
            }}
          >
            📥 Import
          </button>
          <button
            onClick={handleLogout}
            style={{
              background: '#ef4444',
              color: '#fff',
              border: 'none',
              padding: '8px 16px',
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
            background: '#fbbf24',
            color: '#000',
            padding: 12,
            borderRadius: 8,
            marginBottom: 20,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
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
            marginBottom: 20
          }}
        >
          <h3 style={{ margin: '0 0 10px 0' }}>✨ AI Insights</h3>
          <p style={{ margin: '5px 0' }}>
            📈 Forecast: ${aiInsights.forecastTotal.toFixed(2)} this month
          </p>
          <p style={{ margin: '5px 0' }}>
            🔁 Recurring: {aiInsights.recurringExpenses.join(', ') || 'None detected'}
          </p>
          <p style={{ margin: '5px 0' }}>
            🏆 Top Categories:{' '}
            {aiInsights.categorySpending.map((c) => `${c.name} ($${c.spent.toFixed(2)})`).join(', ')}
          </p>
        </div>
      )}

      {!isProMode && (
        <div
          style={{
            background: '#f59e0b',
            color: '#000',
            padding: 15,
            borderRadius: 8,
            marginBottom: 20,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <span>🚀 Upgrade to PRO for AI insights & advanced features</span>
          <button
            onClick={() => {
              trackActivity('stripe_checkout_initiated')
              setShowPaywall(true)
            }}
            style={{
              background: '#fff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Upgrade
          </button>
        </div>
      )}

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
        isSaving={isSaving}
        saveSuccess={saveSuccess}
        addExpense={addExpense}
        showMoreOptions={showMoreOptions}
        setShowMoreOptions={setShowMoreOptions}
        isTaxDeductible={isTaxDeductible}
        setIsTaxDeductible={setIsTaxDeductible}
        notes={notes}
        setNotes={setNotes}
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
      />

      <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
        <button
          onClick={() => {
            setShowAddCategory(!showAddCategory)
          }}
          style={{
            background: '#8b5cf6',
            color: '#fff',
            border: 'none',
            padding: '10px 20px',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 14
          }}
        >
          {showAddCategory ? 'Cancel' : '➕ Add Category'}
        </button>
        <button
          onClick={exportCsv}
          style={{
            background: '#06b6d4',
            color: '#fff',
            border: 'none',
            padding: '10px 20px',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 14
          }}
        >
          📥 Export CSV
        </button>
      </div>

      {showAddCategory && (
        <div style={{ marginBottom: 20 }}>
          <input
            type="text"
            placeholder="New category name"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            style={{
              width: 200,
              padding: 8,
              borderRadius: 8,
              border: '1px solid #ccc',
              marginRight: 10
            }}
          />
          <button
            onClick={addCategory}
            style={{
              background: '#10b981',
              color: '#fff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: 8,
              cursor: 'pointer'
            }}
          >
            Save
          </button>
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <input
          type="text"
          placeholder="Search expenses..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            padding: 10,
            borderRadius: 8,
            border: '1px solid #ccc',
            fontSize: 14
          }}
        />
        <label style={{ display: 'flex', alignItems: 'center', marginTop: 10 }}>
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            style={{ marginRight: 8 }}
          />
          Show archived
        </label>
      </div>

      <ExpenseList
        expenses={expenses}
        categories={categories}
        updateExpense={updateExpense}
        archiveWithUndo={archiveWithUndo}
        deleteExpense={deleteExpense}
        openReceipt={openReceipt}
      />

      <MonthlySummary expenses={allExpenses} categories={categories} />

      {isProMode && (
        <ChatAssistant
          expenses={allExpenses}
          categories={categories}
          onCommand={handleAICommand}
          notifications={notifications}
        />
      )}
    </div>
  )
}
export default App
