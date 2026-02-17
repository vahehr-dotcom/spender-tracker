import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom'

import Login from './components/Login'
import Onboarding from './components/Onboarding'
import Header from './components/Header'
import ChatAssistant from './components/ChatAssistant'
import AddExpenseForm from './components/AddExpenseForm'
import ExpenseList from './components/ExpenseList'
import MonthlySummary from './components/MonthlySummary'
import FileImport from './components/FileImport'
import ImportPreview from './components/ImportPreview'
import UpgradeModal from './components/UpgradeModal'
import AdminPanel from './components/AdminPanel'
import AnalyticsDashboard from './components/AnalyticsDashboard'
import LoginHistoryPage from './pages/LoginHistoryPage'

import { useAuth, useUserData, useExpenses } from './hooks'
import { supabase } from './supabaseClient'

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

function MainApp() {
  const {
    session,
    loading: authLoading,
    loginStatus,
    handleLogin,
    handleLogout,
    startSession,
    logLogin,
    logPageView
  } = useAuth()

  const {
    userProfile,
    subscriptionStatus,
    categories,
    loadAllUserData,
    checkOnboardingStatus,
    saveUserProfile,
    isAdmin,
    isTester
  } = useUserData()

  const {
    expenses,
    pendingUndo,
    loadExpenses,
    addExpense,
    updateExpense,
    archiveExpense,
    deleteExpense,
    undoAction,
    calculateAIInsights
  } = useExpenses(session?.user?.id)

  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [showAdmin, setShowAdmin] = useState(false)
  const [parsedTransactions, setParsedTransactions] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [testMode, setTestMode] = useState(false)

  const navigate = useNavigate()

  const categoriesRef = React.useRef(categories)
  useEffect(() => { categoriesRef.current = categories }, [categories])

  useEffect(() => {
    if (session?.user) {
      const initializeUser = async () => {
        const { needsOnboarding } = await checkOnboardingStatus(session.user.id)
        
        if (needsOnboarding) {
          setShowOnboarding(true)
        } else {
          setShowOnboarding(false)
          await loadAllUserData(session.user.id, session.user.email)
          await loadExpenses(session.user.id)
        }

        startSession(session.user.id, session.user.email)
        logLogin(session.user.email)
        logPageView(session.user.id)
      }

      initializeUser()
    }
  }, [session])

  const handleOnboardingComplete = async (profileData) => {
    const result = await saveUserProfile(session.user.id, profileData)
    
    if (result.success) {
      setShowOnboarding(false)
      await loadAllUserData(session.user.id, session.user.email)
      await loadExpenses(session.user.id)
    }
    
    return result
  }

  const getLocalISOString = (date) => {
    const offset = -date.getTimezoneOffset()
    const sign = offset >= 0 ? '+' : '-'
    const hours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0')
    const minutes = String(Math.abs(offset) % 60).padStart(2, '0')
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const min = String(date.getMinutes()).padStart(2, '0')
    const sec = String(date.getSeconds()).padStart(2, '0')
    return `${year}-${month}-${day}T${hour}:${min}:${sec}${sign}${hours}:${minutes}`
  }

  const allExpenses = showArchived ? expenses : expenses.filter(e => !e.archived)
  const filteredExpenses = allExpenses.filter(expense => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      expense.merchant?.toLowerCase().includes(search) ||
      (categories.find(c => c.id === expense.category_id)?.name || '').toLowerCase().includes(search) ||
      (expense.note || '').toLowerCase().includes(search)
    )
  })

  const isProMode = !testMode && subscriptionStatus === 'pro'
  const aiInsights = isProMode ? calculateAIInsights(allExpenses, categories) : null

  const handleAICommand = async (command) => {
    const { action, data } = command
    console.log('🎯 handleAICommand called:', action, data)

    if (action === 'add_expense') {
      let now = new Date()
      if (data.dateHint === 'yesterday') {
        now.setDate(now.getDate() - 1)
      }
      const spentAt = getLocalISOString(now)

      const currentCategories = categoriesRef.current || []
      const defaultCategoryId = currentCategories.length > 0 ? currentCategories[0].id : null
      console.log('📂 Categories available:', currentCategories.length, 'Default ID:', defaultCategoryId)
      
      if (!defaultCategoryId) {
        console.error('❌ No categories available')
        return { success: false, error: 'No categories available' }
      }

      const expense = {
        user_id: session.user.id,
        amount: parseFloat(data.amount),
        merchant: data.merchant,
        category_id: defaultCategoryId,
        spent_at: spentAt,
        payment_method: 'card',
        archived: false
      }

      console.log('💰 Inserting expense:', expense)

      try {
        const { data: insertedData, error } = await supabase
          .from('expenses')
          .insert([expense])
          .select()

        if (error) {
          console.error('❌ Supabase insert error:', error)
          return { success: false, error: error.message }
        }

        console.log('✅ Expense inserted:', insertedData)
        await loadExpenses(session.user.id)
        return { success: true, message: 'Expense added!' }
      } catch (err) {
        console.error('❌ Insert exception:', err)
        return { success: false, error: err.message }
      }
    }

    if (action === 'update_expense') {
      const result = await updateExpense(data.id, data.updates, session.user.id)
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
      await addExpense(exp, session.user.id)
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

  const handleAddExpense = async (expense) => {
    return await addExpense(expense, session.user.id)
  }

  if (authLoading) {
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

  if (showOnboarding) {
    return (
      <Onboarding
        user={session.user}
        onComplete={handleOnboardingComplete}
        onLogout={handleLogout}
      />
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
         <Header
            userProfile={userProfile}
            userEmail={session.user.email}
            isAdmin={isAdmin()}
            isTester={isTester()}
            isProMode={isProMode}
            testMode={testMode}
            onTestModeToggle={() => setTestMode(!testMode)}
            onImport={() => setShowImport(true)}
            onExport={handleExport}
            onLogout={handleLogout}
            onUpgrade={() => setShowUpgrade(true)}
            onOpenAdmin={() => setShowAdmin(true)}
          />

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
            userProfile={userProfile}
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
            <AddExpenseForm
              categories={categories}
              onAddExpense={handleAddExpense}
              isProMode={isProMode}
              onUpgradeToPro={() => setShowUpgrade(true)}
              userId={session.user.id}
            />
          </div>

          <div style={{ background: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            <MonthlySummary expenses={allExpenses} categories={categories} isProMode={isProMode} />
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
            onUpdate={(id, updates) => updateExpense(id, updates, session.user.id)}
            onArchive={(id) => archiveExpense(id, session.user.id)}
            onDelete={(id) => deleteExpense(id, session.user.id)}
            onOpenReceipt={(url) => window.open(url, '_blank')}
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
                onClick={() => undoAction(session.user.id)}
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

      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}
      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}
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
