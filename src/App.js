import React, { useState, useEffect, useRef } from 'react'
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Login from './components/Login'
import ChatAssistant from './components/ChatAssistant'
import AddExpenseForm from './components/AddExpenseForm'
import ExpenseList from './components/ExpenseList'
import MonthlySummary from './components/MonthlySummary'
import FileImport from './components/FileImport'
import ImportPreview from './components/ImportPreview'
import AnalyticsDashboard from './components/AnalyticsDashboard'
import LoginHistoryPage from './pages/LoginHistoryPage'
import ProactiveEngine from './lib/ProactiveEngine'
import PatternAnalyzer from './lib/PatternAnalyzer'
import PredictiveEngine from './lib/PredictiveEngine'

const AnalyticsPage = () => {
  const navigate = useNavigate()
  return (
    <div style={{ padding: '20px' }}>
      <button onClick={() => navigate('/')} style={{ marginBottom: '20px', padding: '10px 20px', cursor: 'pointer' }}>
        ← Back to Dashboard
      </button>
      <AnalyticsDashboard />
    </div>
  )
}

// AddExpenseForm Wrapper Component
function AddExpenseFormWrapper({ categories, onAddExpense, isProMode, onUpgradeToPro, userId }) {
  const [amount, setAmount] = useState('')
  const [merchant, setMerchant] = useState('')
  const [spentAtLocal, setSpentAtLocal] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('card')
  const [categoryId, setCategoryId] = useState('')
  const [showMoreOptions, setShowMoreOptions] = useState(false)
  const [isTaxDeductible, setIsTaxDeductible] = useState(false)
  const [notes, setNotes] = useState('')
  const [isReimbursable, setIsReimbursable] = useState(false)
  const [employerOrClient, setEmployerOrClient] = useState('')
  const [tagsText, setTagsText] = useState('')
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [receiptFile, setReceiptFile] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [categoryLearnedSource, setCategoryLearnedSource] = useState(null)

  const customCategories = categories.filter(c => c.is_custom)
  const customCount = customCategories.length
  const canAddCategory = isProMode || customCount < 3

  const handleAddCustomCategory = async () => {
    if (!newCategoryName.trim()) {
      alert('Please enter a category name')
      return
    }

    if (!canAddCategory) {
      alert('You have reached the limit of 3 custom categories. Upgrade to PRO for unlimited.')
      return
    }

    try {
      const { data, error } = await supabase
        .from('categories')
        .insert({
          user_id: userId,
          name: newCategoryName.trim(),
          is_custom: true
        })
        .select()
        .single()

      if (error) throw error

      setNewCategoryName('')
      setShowAddCategory(false)
      setCategoryId(data.id)
      window.location.reload() // Reload to refresh categories
    } catch (err) {
      console.error('Add category error:', err)
      alert('Failed to add category')
    }
  }

  const handleSave = async () => {
    if (!amount || !merchant || !categoryId || !paymentMethod) {
      alert('Please fill in all required fields (Amount, Paid to, Category, Payment Method)')
      return
    }

    setIsSaving(true)
    setSaveSuccess(false)

    const expense = {
      amount: parseFloat(amount),
      merchant: merchant.trim(),
      category_id: categoryId,
      payment_method: paymentMethod,
      spent_at: spentAtLocal ? new Date(spentAtLocal).toISOString() : new Date().toISOString(),
      note: notes.trim() || null,
      receipt: receiptFile,
      is_tax_deductible: isTaxDeductible,
      is_reimbursable: isReimbursable,
      employer_or_client: isReimbursable ? employerOrClient.trim() : null,
      tags: tagsText.trim() ? tagsText.split(',').map(t => t.trim()).filter(Boolean) : []
    }

    const result = await onAddExpense(expense)

    setIsSaving(false)

    if (result.success) {
      setSaveSuccess(true)
      // Reset form
      setAmount('')
      setMerchant('')
      setSpentAtLocal('')
      setPaymentMethod('card')
      setCategoryId('')
      setNotes('')
      setIsTaxDeductible(false)
      setIsReimbursable(false)
      setEmployerOrClient('')
      setTagsText('')
      setReceiptFile(null)
      setCategoryLearnedSource(null)
      setTimeout(() => setSaveSuccess(false), 2000)
    } else {
      alert(`Failed to add expense: ${result.error}`)
    }
  }

  return (
    <AddExpenseForm
      amount={amount}
      setAmount={setAmount}
      merchant={merchant}
      setMerchant={setMerchant}
      spentAtLocal={spentAtLocal}
      setSpentAtLocal={setSpentAtLocal}
      paymentMethod={paymentMethod}
      setPaymentMethod={setPaymentMethod}
      categoryId={categoryId}
      setCategoryId={setCategoryId}
      categories={categories}
      showMoreOptions={showMoreOptions}
      setShowMoreOptions={setShowMoreOptions}
      isTaxDeductible={isTaxDeductible}
      setIsTaxDeductible={setIsTaxDeductible}
      notes={notes}
      setNotes={setNotes}
      isProMode={isProMode}
      isReimbursable={isReimbursable}
      setIsReimbursable={setIsReimbursable}
      employerOrClient={employerOrClient}
      setEmployerOrClient={setEmployerOrClient}
      tagsText={tagsText}
      setTagsText={setTagsText}
      showAddCategory={showAddCategory}
      setShowAddCategory={setShowAddCategory}
      newCategoryName={newCategoryName}
      setNewCategoryName={setNewCategoryName}
      customCount={customCount}
      canAddCategory={canAddCategory}
      onAddCustomCategory={handleAddCustomCategory}
      onUpgradeToPro={onUpgradeToPro}
      receiptFile={receiptFile}
      setReceiptFile={setReceiptFile}
      onSave={handleSave}
      isSaving={isSaving}
      saveSuccess={saveSuccess}
      categoryLearnedSource={categoryLearnedSource}
    />
  )
}

function MainApp() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expenses, setExpenses] = useState([])
  const [categories, setCategories] = useState([])
  const [showArchived, setShowArchived] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [pendingUndo, setPendingUndo] = useState(null)
  const [showImport, setShowImport] = useState(false)
  const [parsedTransactions, setParsedTransactions] = useState([])
  const [userRole, setUserRole] = useState('user')
  const [userProfile, setUserProfile] = useState(null)
  const [subscriptionStatus, setSubscriptionStatus] = useState('basic')
  const [testMode, setTestMode] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [loginStatus, setLoginStatus] = useState('')

  const sessionIdRef = useRef(null)
  const intervalRef = useRef(null)
  const sessionStartRef = useRef(null)
  const merchantMemoryRef = useRef({})

  const navigate = useNavigate()

  const allExpenses = showArchived ? expenses : expenses.filter(e => !e.archived)
  const filteredExpenses = allExpenses.filter(expense => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      expense.merchant.toLowerCase().includes(search) ||
      (categories.find(c => c.id === expense.category_id)?.name || '').toLowerCase().includes(search) ||
      (expense.note || '').toLowerCase().includes(search)
    )
  })

  useEffect(() => {
    const initSession = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession()
        setSession(currentSession)
        setLoading(false)
      } catch (error) {
        console.error('Session init error:', error)
        setLoading(false)
      }
    }

    initSession()

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setLoading(false)
    })

    window.addEventListener('beforeunload', () => {
      if (sessionIdRef.current && sessionStartRef.current) {
        const duration = Math.floor((Date.now() - sessionStartRef.current) / 1000)
        const url = `${process.env.REACT_APP_SUPABASE_URL}/rest/v1/user_sessions?id=eq.${sessionIdRef.current}`
        const body = JSON.stringify({
          session_end: new Date().toISOString(),
          duration_seconds: duration
        })
        navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))
      }
    })

    return () => {
      if (authListener && authListener.subscription) {
        authListener.subscription.unsubscribe()
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (session?.user) {
      // Load all user data in parallel
      Promise.all([
        loadUserRole(session.user.id),
        loadUserProfile(session.user.id),
        loadSubscription(session.user.email),
        loadCategories(session.user.id),
        loadExpenses(session.user.id)
      ])
      
      startSession(session.user.id, session.user.email)
      logLogin(session.user.email)
      logPageView(session.user.id)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [session])

  const handleLogin = async (email, password) => {
    try {
      setLoginStatus('Logging in...')
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        setLoginStatus(`Error: ${error.message}`)
        return
      }

      setSession(data.session)
      setLoginStatus('Login successful!')
    } catch (err) {
      console.error('Login error:', err)
      setLoginStatus('Login failed. Please try again.')
    }
  }

  const startSession = async (userId, email) => {
    try {
      const { data: existingSession } = await supabase
        .from('user_sessions')
        .select('id')
        .eq('user_id', userId)
        .is('session_end', null)
        .single()

      if (existingSession) {
        sessionIdRef.current = existingSession.id
      } else {
        const { data: newSession, error } = await supabase
          .from('user_sessions')
          .insert({
            user_id: userId,
            email: email,
            session_start: new Date().toISOString(),
            last_activity: new Date().toISOString(),
            device_info: navigator.userAgent
          })
          .select()
          .single()

        if (error) {
          console.error('Session start error:', error)
          return
        }

        sessionIdRef.current = newSession.id
        sessionStartRef.current = Date.now()
      }

      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }

      intervalRef.current = setInterval(() => {
        updateSessionActivity()
      }, 30000)

    } catch (err) {
      console.error('Start session error:', err)
    }
  }

  const updateSessionActivity = async () => {
    if (!sessionIdRef.current) return

    try {
      await supabase
        .from('user_sessions')
        .update({ last_activity: new Date().toISOString() })
        .eq('id', sessionIdRef.current)
    } catch (err) {
      console.error('Update activity error:', err)
    }
  }

  const logLogin = async (email) => {
    try {
      await supabase.from('login_logs').insert({
        email: email,
        login_time: new Date().toISOString()
      })
      console.log('App: login tracked for', email)
    } catch (err) {
      console.error('Login log error:', err)
    }
  }

  const logPageView = async (userId) => {
    try {
      await supabase.from('page_views').insert({
        user_id: userId,
        page: '/',
        viewed_at: new Date().toISOString()
      })
    } catch (err) {
      console.error('Page view log error:', err)
    }
  }

  const loadUserRole = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('preference_value')
        .eq('user_id', userId)
        .eq('preference_type', 'role')
        .single()

      if (error) {
        console.error('Load role error:', error)
        setUserRole('user')
        return
      }

      setUserRole(data?.preference_value || 'user')
    } catch (err) {
      console.error('Role load error:', err)
      setUserRole('user')
    }
  }

  const loadUserProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('preference_type, preference_value')
        .eq('user_id', userId)
        .in('preference_type', ['display_name', 'title'])

      if (error) {
        console.error('Load profile error:', error)
        return
      }

      const profile = {}
      data.forEach(pref => {
        profile[pref.preference_type] = pref.preference_value
      })

      console.log('Loaded user profile:', profile)
      setUserProfile(profile)
    } catch (err) {
      console.error('Profile load error:', err)
    }
  }

  const loadSubscription = async (email) => {
    // CEO and testers get PRO
    const proEmails = ['lifeliftusa@gmail.com', 'awillie2006@gmail.com', 'sako3000@gmail.com']
    if (proEmails.includes(email)) {
      setSubscriptionStatus('pro')
      return
    }

    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('email', email)
        .single()

      if (error) {
        setSubscriptionStatus('basic')
        return
      }

      setSubscriptionStatus(data?.status || 'basic')
    } catch (err) {
      setSubscriptionStatus('basic')
    }
  }

  const loadCategories = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', userId)
        .order('name')

      if (error) throw error
      setCategories(data || [])
    } catch (err) {
      console.error('Load categories error:', err)
    }
  }

  const loadExpenses = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', userId)
        .order('spent_at', { ascending: false })

      if (error) throw error

      setExpenses(data || [])

      data.forEach(expense => {
        if (expense.merchant && expense.category_id) {
          merchantMemoryRef.current[expense.merchant.toLowerCase()] = expense.category_id
        }
      })
    } catch (err) {
      console.error('Load expenses error:', err)
    }
  }

  const addExpense = async (expense) => {
    try {
      let receiptUrl = null

      if (expense.receipt) {
        const fileName = `${Date.now()}_${expense.receipt.name}`
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(fileName, expense.receipt)

        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage
          .from('receipts')
          .getPublicUrl(fileName)

        receiptUrl = urlData.publicUrl
      }

      let location = null
      if (navigator.geolocation) {
        try {
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
          })

          const { latitude, longitude } = position.coords
          const geoResponse = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
          )
          const geoData = await geoResponse.json()
          location = geoData.display_name || `${latitude}, ${longitude}`
        } catch (geoErr) {
          console.warn('Geolocation failed:', geoErr)
        }
      }

      const newExpense = {
        user_id: session.user.id,
        amount: parseFloat(expense.amount),
        merchant: expense.merchant,
        category_id: expense.category_id,
        spent_at: expense.spent_at || new Date().toISOString(),
        payment_method: expense.payment_method || 'credit_card',
        note: expense.note || null,
        receipt_image_url: receiptUrl,
        location: location,
        archived: false
      }

      const { error } = await supabase.from('expenses').insert([newExpense])

      if (error) throw error

      await loadExpenses(session.user.id)
      return { success: true }
    } catch (err) {
      console.error('Add expense error:', err)
      return { success: false, error: err.message }
    }
  }

  const updateExpense = async (id, updates) => {
    try {
      const { error } = await supabase
        .from('expenses')
        .update(updates)
        .eq('id', id)

      if (error) throw error

      await loadExpenses(session.user.id)
      return { success: true }
    } catch (err) {
      console.error('Update expense error:', err)
      return { success: false, error: err.message }
    }
  }

  const archiveExpense = async (id) => {
    const expense = expenses.find(e => e.id === id)
    if (!expense) return

    try {
      const { error } = await supabase
        .from('expenses')
        .update({ archived: true })
        .eq('id', id)

      if (error) throw error

      setPendingUndo({ action: 'archive', expense })
      await loadExpenses(session.user.id)

      setTimeout(() => {
        setPendingUndo(null)
      }, 5000)
    } catch (err) {
      console.error('Archive error:', err)
    }
  }

  const deleteExpense = async (id) => {
    const expense = expenses.find(e => e.id === id)
    if (!expense) return

    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id)

      if (error) throw error

      setPendingUndo({ action: 'delete', expense })
      await loadExpenses(session.user.id)

      setTimeout(() => {
        setPendingUndo(null)
      }, 5000)
    } catch (err) {
      console.error('Delete error:', err)
    }
  }

  const undoAction = async () => {
    if (!pendingUndo) return

    try {
      if (pendingUndo.action === 'archive') {
        await supabase
          .from('expenses')
          .update({ archived: false })
          .eq('id', pendingUndo.expense.id)
      } else if (pendingUndo.action === 'delete') {
        await supabase.from('expenses').insert([pendingUndo.expense])
      }

      setPendingUndo(null)
      await loadExpenses(session.user.id)
    } catch (err) {
      console.error('Undo error:', err)
    }
  }

  const openReceipt = (url) => {
    window.open(url, '_blank')
  }

  const handleImport = async (file) => {
    const text = await file.text()
    const lines = text.split('\n').filter(line => line.trim())
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase())

    const transactions = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim())
      const obj = {}
      headers.forEach((h, i) => {
        obj[h] = values[i] || ''
      })
      return obj
    })

    setParsedTransactions(transactions)
    setShowImport(true)
  }

  const handleImportConfirm = async (mappedExpenses) => {
    for (const exp of mappedExpenses) {
      await addExpense(exp)
    }
    setShowImport(false)
    setParsedTransactions([])
  }

  const handleExport = () => {
    const headers = ['Date', 'Merchant', 'Category', 'Amount', 'Payment Method', 'Notes']
    const rows = filteredExpenses.map(e => [
      new Date(e.spent_at).toLocaleDateString(),
      e.merchant,
      categories.find(c => c.id === e.category_id)?.name || '',
      e.amount,
      e.payment_method,
      e.note || ''
    ])

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `expenses_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const handleLogout = async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (sessionIdRef.current && sessionStartRef.current) {
      const duration = Math.floor((Date.now() - sessionStartRef.current) / 1000)
      try {
        await supabase
          .from('user_sessions')
          .update({
            session_end: new Date().toISOString(),
            duration_seconds: duration
          })
          .eq('id', sessionIdRef.current)
      } catch (err) {
        console.error('Session end error:', err)
      }
    }

    await supabase.auth.signOut()
    setSession(null)
  }

  const handleAICommand = async (command) => {
    const { action, data } = command

    if (action === 'add_expense') {
      const result = await addExpense(data)
      return result.success ? { success: true, message: 'Expense added!' } : { success: false, message: result.error }
    }

    if (action === 'update_expense') {
      const result = await updateExpense(data.id, data.updates)
      return result.success ? { success: true, message: 'Expense updated!' } : { success: false, message: result.error }
    }

    if (action === 'search') {
      setSearchTerm(data.term)
      return { success: true, message: `Searching for: ${data.term}` }
    }

    if (action === 'export') {
      handleExport()
      return { success: true, message: 'Expenses exported!' }
    }

    return { success: false, message: 'Unknown command' }
  }

  const calculateAIInsights = () => {
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()

    const thisMonthExpenses = allExpenses.filter(e => {
      const expenseDate = new Date(e.spent_at)
      return expenseDate.getMonth() === currentMonth && expenseDate.getFullYear() === currentYear
    })

    const totalSpent = thisMonthExpenses.reduce((sum, e) => sum + e.amount, 0)
    const avgDaily = totalSpent / now.getDate()
    const daysLeft = new Date(currentYear, currentMonth + 1, 0).getDate() - now.getDate()
    const forecastTotal = totalSpent + (avgDaily * daysLeft)

    const merchantCounts = {}
    thisMonthExpenses.forEach(e => {
      merchantCounts[e.merchant] = (merchantCounts[e.merchant] || 0) + 1
    })
    const recurringMerchants = Object.entries(merchantCounts)
      .filter(([_, count]) => count >= 2)
      .map(([merchant]) => merchant)

    const categoryTotals = {}
    thisMonthExpenses.forEach(e => {
      const catName = categories.find(c => c.id === e.category_id)?.name || 'Other'
      categoryTotals[catName] = (categoryTotals[catName] || 0) + e.amount
    })
    const topCategories = Object.entries(categoryTotals)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([name, amount]) => ({ name, amount }))

    return {
      forecastTotal,
      recurringMerchants,
      topCategories
    }
  }

  const isProMode = !testMode && subscriptionStatus === 'pro'
  const aiInsights = isProMode ? calculateAIInsights() : null

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p>Loading...</p>
      </div>
    )
  }

  if (!session) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        <Login onLogin={handleLogin} status={loginStatus} />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '20px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '30px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h1 style={{ margin: 0, fontSize: '32px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Nova Expense Tracker
            </h1>

            {/* Greeting for ALL users - centered */}
            <div style={{
              padding: '12px 20px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: '12px',
              color: 'white',
              fontWeight: 'bold',
              fontSize: '16px',
              textAlign: 'center'
            }}>
              {userProfile && userProfile.display_name ? (
                <>Hello, {userProfile.display_name}{userProfile.title ? ` - ${userProfile.title}` : ''}</>
              ) : (
                <>Hello, {session.user.email}</>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {(userRole === 'admin' || ['awillie2006@gmail.com', 'sako3000@gmail.com'].includes(session.user.email)) && (
                <>
                  <button
                    onClick={() => setTestMode(!testMode)}
                    style={{
                      padding: '10px 15px',
                      background: testMode ? '#6b7280' : '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    {testMode ? '⚙️ Basic Mode' : '✅ PRO Mode'}
                  </button>
                  <button
                    onClick={() => navigate('/login-history')}
                    style={{
                      padding: '10px 15px',
                      background: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer'
                    }}
                  >
                    📊 Login History
                  </button>
                  <button
                    onClick={() => navigate('/analytics')}
                    style={{
                      padding: '10px 15px',
                      background: '#8b5cf6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer'
                    }}
                  >
                    📈 Analytics
                  </button>
                </>
              )}

              <button onClick={() => setShowImport(true)} style={{ padding: '10px 15px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                📥 Import
              </button>
              <button onClick={handleExport} style={{ padding: '10px 15px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                📤 Export
              </button>
              <button onClick={handleLogout} style={{ padding: '10px 15px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                Logout
              </button>
            </div>
          </div>

          {!isProMode && (
            <div style={{
              background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
              padding: '15px',
              borderRadius: '12px',
              marginBottom: '20px',
              color: 'white',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontWeight: 'bold' }}>⚡ Unlock PRO features: AI Insights, Voice Commands, Predictions & More!</span>
              <button
                onClick={() => setShowUpgrade(true)}
                style={{
                  padding: '10px 20px',
                  background: 'white',
                  color: '#f59e0b',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Upgrade to PRO
              </button>
            </div>
          )}

          <ChatAssistant
            expenses={allExpenses}
            categories={categories}
            isProMode={isProMode}
            onUpgradeToPro={() => setShowUpgrade(true)}
            onAICommand={handleAICommand}
            userId={session.user.id}
          />

          {isProMode && aiInsights && (
            <div style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              padding: '20px',
              borderRadius: '12px',
              marginTop: '20px',
              color: 'white'
            }}>
              <h3 style={{ marginTop: 0 }}>🤖 AI Insights (PRO)</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
                <div>
                  <p style={{ margin: '5px 0', fontWeight: 'bold' }}>Forecast This Month:</p>
                  <p style={{ margin: 0, fontSize: '24px' }}>${aiInsights.forecastTotal.toFixed(2)}</p>
                </div>
                <div>
                  <p style={{ margin: '5px 0', fontWeight: 'bold' }}>Recurring Merchants:</p>
                  <p style={{ margin: 0 }}>{aiInsights.recurringMerchants.join(', ') || 'None'}</p>
                </div>
                <div>
                  <p style={{ margin: '5px 0', fontWeight: 'bold' }}>Top Categories:</p>
                  {aiInsights.topCategories.map(cat => (
                    <p key={cat.name} style={{ margin: '2px 0' }}>{cat.name}: ${cat.amount.toFixed(2)}</p>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            <AddExpenseFormWrapper
              categories={categories}
              onAddExpense={addExpense}
              isProMode={isProMode}
              onUpgradeToPro={() => setShowUpgrade(true)}
              userId={session.user.id}
            />
          </div>

          <div style={{ background: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            <MonthlySummary expenses={allExpenses} categories={categories} />
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <input
              type="text"
              placeholder="Search expenses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                padding: '10px',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                flex: 1,
                marginRight: '10px'
              }}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />
              Show Archived
            </label>
          </div>

          <ExpenseList
            expenses={filteredExpenses}
            categories={categories}
            onUpdate={updateExpense}
            onArchive={archiveExpense}
            onDelete={deleteExpense}
            onOpenReceipt={openReceipt}
          />

          {pendingUndo && (
            <div style={{
              position: 'fixed',
              bottom: '20px',
              right: '20px',
              background: '#1f2937',
              color: 'white',
              padding: '15px 20px',
              borderRadius: '12px',
              display: 'flex',
              gap: '15px',
              alignItems: 'center',
              boxShadow: '0 4px 6px rgba(0,0,0,0.2)'
            }}>
              <span>{pendingUndo.action === 'archive' ? 'Expense archived' : 'Expense deleted'}</span>
              <button
                onClick={undoAction}
                style={{
                  padding: '8px 15px',
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Undo
              </button>
            </div>
          )}
        </div>
      </div>

      {showImport && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '30px',
            maxWidth: '800px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            {parsedTransactions.length === 0 ? (
              <FileImport onFileSelect={handleImport} onClose={() => setShowImport(false)} />
            ) : (
              <ImportPreview
                transactions={parsedTransactions}
                categories={categories}
                onConfirm={handleImportConfirm}
                onCancel={() => {
                  setShowImport(false)
                  setParsedTransactions([])
                }}
              />
            )}
          </div>
        </div>
      )}

      {showUpgrade && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '40px',
            maxWidth: '500px',
            textAlign: 'center'
          }}>
            <h2 style={{ marginTop: 0 }}>🚀 Upgrade to PRO</h2>
            <p style={{ fontSize: '18px', color: '#6b7280' }}>
              Unlock AI Insights, Voice Commands, Smart Predictions, and more!
            </p>
            <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#667eea', margin: '20px 0' }}>
              $9.99/month
            </p>
            <button
              onClick={() => setShowUpgrade(false)}
              style={{
                padding: '15px 30px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '16px'
              }}
            >
              Coming Soon!
            </button>
            <button
              onClick={() => setShowUpgrade(false)}
              style={{
                display: 'block',
                margin: '15px auto 0',
                background: 'none',
                border: 'none',
                color: '#6b7280',
                cursor: 'pointer'
              }}
            >
              Maybe Later
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainApp />} />
        <Route path="/login-history" element={<LoginHistoryPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
      </Routes>
    </Router>
  )
}

export default App
