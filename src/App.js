import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { supabase } from './supabaseClient';
import Login from './components/Login';
import ChatAssistant from './components/ChatAssistant';
import AddExpenseForm from './components/AddExpenseForm';
import ExpenseList from './components/ExpenseList';
import MonthlySummary from './components/MonthlySummary';
import FileImport from './components/FileImport';
import ImportPreview from './components/ImportPreview';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import ProactiveEngine from './lib/ProactiveEngine';
import PatternAnalyzer from './lib/PatternAnalyzer';
import PredictiveEngine from './lib/PredictiveEngine';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showArchived, setShowArchived] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingUndo, setPendingUndo] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [parsedTransactions, setParsedTransactions] = useState([]);
  const [userRole, setUserRole] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState('free');
  const [testMode, setTestMode] = useState(false);
  const [showLoginHistory, setShowLoginHistory] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const sessionIdRef = useRef(null);
  const intervalRef = useRef(null);
  const sessionStartRef = useRef(null);
  const merchantMemoryRef = useRef(new Map());

  const isProMode = !testMode && subscriptionStatus === 'pro';

  const allExpenses = useMemo(() => {
    return showArchived 
      ? expenses 
      : expenses.filter(e => !e.archived);
  }, [expenses, showArchived]);

  const filteredExpenses = useMemo(() => {
    if (!searchTerm.trim()) return allExpenses;
    const term = searchTerm.toLowerCase();
    return allExpenses.filter(e =>
      (e.merchant_name || '').toLowerCase().includes(term) ||
      (e.category || '').toLowerCase().includes(term) ||
      (e.notes || '').toLowerCase().includes(term)
    );
  }, [allExpenses, searchTerm]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (session?.user) {
        startSession(session.user.id);
        logLogin(session.user.email);
        logPageView(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        startSession(session.user.id);
        logLogin(session.user.email);
        logPageView(session.user.id);
      }
    });

    return () => subscription?.unsubscribe();
  }, []);

  useEffect(() => {
    const handleUnload = () => {
      if (sessionIdRef.current && sessionStartRef.current) {
        const now = new Date();
        const duration = Math.floor((now - sessionStartRef.current) / 1000);
        navigator.sendBeacon(
          `${process.env.REACT_APP_SUPABASE_URL}/rest/v1/user_sessions?id=eq.${sessionIdRef.current}`,
          JSON.stringify({
            session_end: now.toISOString(),
            duration_seconds: duration
          })
        );
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  const startSession = async (userId) => {
    try {
      const { data: existingSession } = await supabase
        .from('user_sessions')
        .select('id')
        .eq('user_id', userId)
        .is('session_end', null)
        .maybeSingle();

      if (existingSession) {
        sessionIdRef.current = existingSession.id;
        console.log('Continuing session:', existingSession.id);
      } else {
        const { data: newSession, error } = await supabase
          .from('user_sessions')
          .insert({
            user_id: userId,
            session_start: new Date().toISOString()
          })
          .select()
          .maybeSingle();

        if (!error && newSession) {
          sessionIdRef.current = newSession.id;
          sessionStartRef.current = new Date();
        }
      }

      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => updateSessionActivity(sessionIdRef.current), 30000);
    } catch (error) {
      console.error('Error starting session:', error);
    }
  };

  const updateSessionActivity = async (sessionId) => {
    if (!sessionId) return;
    try {
      await supabase
        .from('user_sessions')
        .update({ last_activity: new Date().toISOString() })
        .eq('id', sessionId);
    } catch (error) {
      console.error('Error updating session activity:', error);
    }
  };

  const logLogin = async (email) => {
    try {
      await supabase
        .from('login_logs')
        .insert({ email, logged_in_at: new Date().toISOString() });
      console.log('App: login tracked for', email);
    } catch (error) {
      console.error('Error logging login:', error);
    }
  };

  const logPageView = async (userId) => {
    if (!sessionIdRef.current) return;
    try {
      await supabase
        .from('page_views')
        .insert({
          session_id: sessionIdRef.current,
          user_id: userId,
          page_url: window.location.pathname,
          viewed_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Error logging page view:', error);
    }
  };

  useEffect(() => {
    if (session?.user) {
      loadUserRole(session.user.id);
      loadUserProfile(session.user.id);
      loadSubscription(session.user.id);
      loadCategories(session.user.id);
      loadExpenses(session.user.id);
    }
  }, [session]);

  const loadUserRole = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('role')
        .eq('id', userId)
        .maybeSingle();
      if (!error && data) setUserRole(data.role);
    } catch (error) {
      console.error('Error loading user role:', error);
    }
  };

  const loadUserProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('display_name, title')
        .eq('id', userId)
        .maybeSingle();
      if (!error && data) setUserProfile(data);
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const loadSubscription = async (userId) => {
    try {
      const ceoTestEmails = ['lifeliftusa@gmail.com', 'test@example.com'];
      if (session?.user?.email && ceoTestEmails.includes(session.user.email)) {
        setSubscriptionStatus('pro');
        return;
      }
      const { data, error } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('user_id', userId)
        .maybeSingle();
      if (!error && data) {
        setSubscriptionStatus(data.status || 'free');
      }
    } catch (error) {
      console.error('Error loading subscription:', error);
    }
  };

  const loadCategories = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', userId)
        .order('name');
      if (!error) setCategories(data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadExpenses = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', userId)
        .order('expense_date', { ascending: false });
      if (!error) {
        const expensesWithLocalTime = (data || []).map(e => ({
          ...e,
          spent_at: e.expense_date
        }));
        setExpenses(expensesWithLocalTime);
        updateMerchantMemory(expensesWithLocalTime);
      }
    } catch (error) {
      console.error('Error loading expenses:', error);
    }
  };

  const updateMerchantMemory = (expensesList) => {
    const memoryMap = new Map();
    expensesList.forEach(exp => {
      if (exp.merchant_name && exp.category) {
        memoryMap.set(exp.merchant_name.toLowerCase(), exp.category);
      }
    });
    merchantMemoryRef.current = memoryMap;
  };

  const suggestCategoryForMerchant = async (merchantName) => {
    const lower = merchantName.toLowerCase();
    if (merchantMemoryRef.current.has(lower)) {
      return merchantMemoryRef.current.get(lower);
    }
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{
            role: 'system',
            content: 'You are a helpful assistant that categorizes expenses. Respond with only the category name.'
          }, {
            role: 'user',
            content: `What expense category best fits this merchant: "${merchantName}"? Choose from: Food & Dining, Transportation, Shopping, Entertainment, Healthcare, Bills & Utilities, Travel, Other.`
          }],
          temperature: 0.3,
          max_tokens: 20
        })
      });
      const result = await response.json();
      const suggestedCategory = result.choices?.[0]?.message?.content?.trim() || 'Other';
      return suggestedCategory;
    } catch (error) {
      console.error('Error suggesting category:', error);
      return 'Other';
    }
  };

  const addExpense = async (expenseData) => {
    try {
      let receiptUrl = null;
      if (expenseData.receipt) {
        const fileExt = expenseData.receipt.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(fileName, expenseData.receipt);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage
          .from('receipts')
          .getPublicUrl(fileName);
        receiptUrl = publicUrl;
      }

      let location = null;
      if (navigator.geolocation) {
        try {
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject);
          });
          const { latitude, longitude } = position.coords;
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
          );
          const data = await response.json();
          location = data.display_name || null;
        } catch (error) {
          console.error('Error getting location:', error);
        }
      }

      const newExpense = {
        user_id: session.user.id,
        merchant_name: expenseData.merchant,
        amount: parseFloat(expenseData.amount),
        category: expenseData.category,
        expense_date: expenseData.date,
        payment_method: expenseData.paymentMethod || 'Cash',
        notes: expenseData.notes || '',
        tags: expenseData.tags || [],
        location: location,
        receipt_image_url: receiptUrl,
        tax_deductible: expenseData.taxDeductible || false,
        reimbursable: expenseData.reimbursable || false
      };

      const { data, error } = await supabase
        .from('expenses')
        .insert(newExpense)
        .select()
        .single();

      if (error) throw error;
      await loadExpenses(session.user.id);
      return data;
    } catch (error) {
      console.error('Error adding expense:', error);
      throw error;
    }
  };

  const updateExpense = async (id, updates) => {
    try {
      const { error } = await supabase
        .from('expenses')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
      await loadExpenses(session.user.id);
    } catch (error) {
      console.error('Error updating expense:', error);
      throw error;
    }
  };

  const archiveExpense = async (id) => {
    const expense = expenses.find(e => e.id === id);
    if (!expense) return;
    setPendingUndo({ action: 'archive', expense });
    await updateExpense(id, { archived: true });
    setTimeout(() => setPendingUndo(null), 5000);
  };

  const deleteExpense = async (id) => {
    const expense = expenses.find(e => e.id === id);
    if (!expense) return;
    setPendingUndo({ action: 'delete', expense });
    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);
      if (error) throw error;
      await loadExpenses(session.user.id);
      setTimeout(() => setPendingUndo(null), 5000);
    } catch (error) {
      console.error('Error deleting expense:', error);
    }
  };

  const undoAction = async () => {
    if (!pendingUndo) return;
    const { action, expense } = pendingUndo;
    try {
      if (action === 'archive') {
        await updateExpense(expense.id, { archived: false });
      } else if (action === 'delete') {
        const { error } = await supabase
          .from('expenses')
          .insert(expense)
          .select()
          .single();
        if (error) throw error;
        await loadExpenses(session.user.id);
      }
      setPendingUndo(null);
    } catch (error) {
      console.error('Error undoing action:', error);
    }
  };

  const openReceipt = (url) => {
    window.open(url, '_blank');
  };

  const handleImportComplete = async (transactions) => {
    setParsedTransactions(transactions);
    setShowImport(false);
  };

  const handleImportConfirm = async (confirmedTransactions) => {
    try {
      for (const transaction of confirmedTransactions) {
        await addExpense(transaction);
      }
      setParsedTransactions([]);
      await loadExpenses(session.user.id);
    } catch (error) {
      console.error('Error importing transactions:', error);
    }
  };

  const handleImportCancel = () => {
    setParsedTransactions([]);
  };

  const handleExport = () => {
    const csvData = [
      ['Date', 'Merchant', 'Category', 'Amount', 'Payment Method', 'Notes']
    ];
    filteredExpenses.forEach(expense => {
      csvData.push([
        expense.expense_date,
        expense.merchant_name || '',
        expense.category || '',
        expense.amount,
        expense.payment_method || '',
        expense.notes || ''
      ]);
    });
    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `expenses_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const processReceiptWithOCR = async (file) => {
    try {
      const base64 = await fileToBase64(file);
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract merchant name, total amount, date, and itemized list from this receipt. Return JSON with keys: merchant, amount, date (YYYY-MM-DD), items (array of {name, price}).'
              },
              {
                type: 'image_url',
                image_url: { url: base64 }
              }
            ]
          }],
          max_tokens: 500
        })
      });
      const result = await response.json();
      const content = result.choices?.[0]?.message?.content;
      if (content) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }
      return null;
    } catch (error) {
      console.error('Error processing receipt:', error);
      return null;
    }
  };

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const parseNaturalDate = (text) => {
    const today = new Date();
    const lower = text.toLowerCase();
    if (lower.includes('today')) return today.toISOString().split('T')[0];
    if (lower.includes('yesterday')) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday.toISOString().split('T')[0];
    }
    return today.toISOString().split('T')[0];
  };

  const handleAICommand = async (command) => {
    try {
      if (command.action === 'add_expense') {
        await addExpense(command.data);
      } else if (command.action === 'update_expense') {
        await updateExpense(command.expenseId, command.updates);
      } else if (command.action === 'search') {
        setSearchTerm(command.query || '');
      } else if (command.action === 'export') {
        handleExport();
      }
    } catch (error) {
      console.error('Error handling AI command:', error);
    }
  };

  const calculateAIInsights = () => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const currentMonthExpenses = allExpenses.filter(e => {
      const expDate = new Date(e.expense_date);
      return expDate.getMonth() === currentMonth && expDate.getFullYear() === currentYear;
    });
    const totalSpent = currentMonthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const avgDailySpend = totalSpent / now.getDate();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const forecastTotal = avgDailySpend * daysInMonth;

    const merchantCounts = {};
    allExpenses.forEach(e => {
      const m = e.merchant_name || '';
      merchantCounts[m] = (merchantCounts[m] || 0) + 1;
    });
    const recurring = Object.entries(merchantCounts)
      .filter(([_, count]) => count >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([merchant]) => merchant);

    const categoryTotals = {};
    currentMonthExpenses.forEach(e => {
      const cat = e.category || 'Other';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + e.amount;
    });
    const topCategories = Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, amount]) => ({ category, amount }));

    return {
      forecastTotal,
      recurringMerchants: recurring,
      topCategories
    };
  };

  const insights = isProMode ? calculateAIInsights() : null;

  const handleLogout = async () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    await supabase.auth.signOut();
  };

  if (loading) {
    return <div style={{ padding: 20 }}>Loading...</div>;
  }

  if (!session) {
    return <Login />;
  }

  const isAdmin = userRole === 'admin' || session.user.email === 'lifeliftusa@gmail.com';

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: 1200, margin: '0 auto', padding: 20 }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 20,
        padding: 15,
        backgroundColor: '#f5f5f5',
        borderRadius: 8
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28 }}>Nova Expense Tracker</h1>
          {userProfile && (
            <p style={{ margin: '5px 0 0 0', color: '#666' }}>
              Hello {userProfile.display_name} {userProfile.title && `• ${userProfile.title}`}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {isAdmin && (
            <>
              <button
                onClick={() => setTestMode(!testMode)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: testMode ? '#ff9800' : '#4caf50',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer'
                }}
              >
                {testMode ? 'Basic Mode' : 'PRO Mode'}
              </button>
              <button
                onClick={() => setShowLoginHistory(!showLoginHistory)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#2196f3',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer'
                }}
              >
                Login History
              </button>
              <button
                onClick={() => setShowAnalytics(!showAnalytics)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#9c27b0',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer'
                }}
              >
                Analytics
              </button>
            </>
          )}
          <button
            onClick={() => setShowImport(!showImport)}
            style={{
              padding: '8px 16px',
              backgroundColor: '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer'
            }}
          >
            Import
          </button>
          <button
            onClick={handleExport}
            style={{
              padding: '8px 16px',
              backgroundColor: '#ff9800',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer'
            }}
          >
            Export
          </button>
          <button
            onClick={handleLogout}
            style={{
              padding: '8px 16px',
              backgroundColor: '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer'
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {pendingUndo && (
        <div style={{
          padding: 15,
          backgroundColor: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: 4,
          marginBottom: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>Action performed. Click undo to reverse.</span>
          <button
            onClick={undoAction}
            style={{
              padding: '8px 16px',
              backgroundColor: '#ff9800',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer'
            }}
          >
            Undo
          </button>
        </div>
      )}

      {session?.user && (
        <div style={{ marginBottom: 20 }}>
          <ChatAssistant
            userId={session?.user?.id}
            expenses={allExpenses}
            categories={categories}
            onCommand={handleAICommand}
            notifications={[]}
            isProMode={isProMode}
          />
        </div>
      )}

      {isProMode && insights && (
        <div style={{
          padding: 20,
          backgroundColor: '#f3e5f5',
          borderRadius: 8,
          marginBottom: 20
        }}>
          <h3 style={{ marginTop: 0, color: '#7b1fa2' }}>AI Insights (PRO only)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 15 }}>
            <div>
              <h4 style={{ margin: '0 0 10px 0' }}>Forecast</h4>
              <p style={{ margin: 0, fontSize: 24, fontWeight: 'bold', color: '#7b1fa2' }}>
                ${insights.forecastTotal.toFixed(2)}
              </p>
              <p style={{ margin: '5px 0 0 0', fontSize: 12, color: '#666' }}>
                Projected monthly total
              </p>
            </div>
            <div>
              <h4 style={{ margin: '0 0 10px 0' }}>Recurring Merchants</h4>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {insights.recurringMerchants.map((m, i) => (
                  <li key={i} style={{ fontSize: 14 }}>{m}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4 style={{ margin: '0 0 10px 0' }}>Top Categories</h4>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {insights.topCategories.map((item, i) => (
                  <li key={i} style={{ fontSize: 14 }}>
                    {item.category}: ${item.amount.toFixed(2)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {!isProMode && (
        <div style={{
          padding: 20,
          backgroundColor: '#e3f2fd',
          borderRadius: 8,
          marginBottom: 20,
          textAlign: 'center'
        }}>
          <h3 style={{ marginTop: 0, color: '#1976d2' }}>Upgrade to Unlimited in Pro mode</h3>
          <p style={{ marginBottom: 15 }}>Get AI Insights, unlimited expenses, and more!</p>
          <button
            onClick={() => setShowUpgrade(true)}
            style={{
              padding: '12px 24px',
              backgroundColor: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 16,
              fontWeight: 'bold'
            }}
          >
            Upgrade Now
          </button>
        </div>
      )}

      {showUpgrade && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: 40,
            borderRadius: 8,
            maxWidth: 500,
            width: '90%'
          }}>
            <h2 style={{ marginTop: 0 }}>Upgrade to PRO</h2>
            <p>Unlock unlimited expenses, AI insights, and advanced features.</p>
            <p style={{ fontSize: 32, fontWeight: 'bold', color: '#1976d2', margin: '20px 0' }}>
              $9.99/month
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowUpgrade(false)}
                style={{
                  flex: 1,
                  padding: '12px 24px',
                  backgroundColor: '#ccc',
                  color: '#333',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  alert('Stripe integration coming soon!');
                  setShowUpgrade(false);
                }}
                style={{
                  flex: 1,
                  padding: '12px 24px',
                  backgroundColor: '#1976d2',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer'
                }}
              >
                Subscribe
              </button>
            </div>
          </div>
        </div>
      )}

      {isAdmin && showLoginHistory && (
        <div style={{ marginBottom: 20 }}>
          <h3>Login History</h3>
          <p>Admin panel - login history will appear here</p>
        </div>
      )}

      {isAdmin && showAnalytics && (
        <div style={{ marginBottom: 20 }}>
          <AnalyticsDashboard />
        </div>
      )}

      {showImport && (
        <div style={{ marginBottom: 20 }}>
          <FileImport onComplete={handleImportComplete} />
        </div>
      )}

      {parsedTransactions.length > 0 && (
        <ImportPreview
          transactions={parsedTransactions}
          onConfirm={handleImportConfirm}
          onCancel={handleImportCancel}
        />
      )}

      <AddExpenseForm
        onAddExpense={addExpense}
        categories={categories}
        onSuggestCategory={suggestCategoryForMerchant}
        onProcessReceipt={processReceiptWithOCR}
      />

      <MonthlySummary expenses={filteredExpenses} />

      <div style={{ marginBottom: 20 }}>
        <input
          type="text"
          placeholder="Search expenses..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: 12,
            fontSize: 16,
            border: '1px solid #ddd',
            borderRadius: 4
          }}
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Show archived expenses
        </label>
      </div>

      <ExpenseList
        expenses={filteredExpenses}
        categories={categories}
        onUpdateExpense={updateExpense}
        onArchiveExpense={archiveExpense}
        onDeleteExpense={deleteExpense}
        onOpenReceipt={openReceipt}
      />
    </div>
  );
}

export default App;
