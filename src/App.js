import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import LoginHistoryPage from './pages/LoginHistoryPage';
import { supabase } from './supabaseClient';
import Login from './components/Login';
import ChatAssistant from './components/ChatAssistant';
import AddExpenseForm from './components/AddExpenseForm';
import ExpenseList from './components/ExpenseList';
import MonthlySummary from './components/MonthlySummary';
import FileImport from './components/FileImport';
import ImportPreview from './components/ImportPreview';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import { ProactiveEngine } from './lib/ProactiveEngine';
import { PatternAnalyzer } from './lib/PatternAnalyzer';
import { PredictiveEngine } from './lib/PredictiveEngine';

function AnalyticsPage() {
  const navigate = useNavigate();
  return (
    <div style={{ padding: '20px' }}>
      <button onClick={() => navigate('/')} style={{ marginBottom: '20px', padding: '10px 20px', cursor: 'pointer', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px' }}>
        ← Back to Dashboard
      </button>
      <AnalyticsDashboard />
    </div>
  );
}

function MainApp() {
  const navigate = useNavigate();
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
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [loginStatus, setLoginStatus] = useState('');

  const sessionIdRef = useRef(null);
  const intervalRef = useRef(null);
  const sessionStartRef = useRef(null);
  const merchantMemoryRef = useRef(new Map());

  const isProMode = !testMode && subscriptionStatus === 'pro';

  const allExpenses = useMemo(() => {
    return showArchived ? expenses : expenses.filter(e => !e.archived);
  }, [expenses, showArchived]);

  const filteredExpenses = useMemo(() => {
    if (!searchTerm.trim()) return allExpenses;
    const term = searchTerm.toLowerCase();
    return allExpenses.filter(expense => 
      expense.merchant?.toLowerCase().includes(term) ||
      expense.category?.toLowerCase().includes(term) ||
      expense.note?.toLowerCase().includes(term)
    );
  }, [allExpenses, searchTerm]);

  useEffect(() => {
    const initSession = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);
      setLoading(false);
    };
    initSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session?.user) {
      startSession(session.user.id);
      loadUserRole(session.user.id);
      loadUserProfile(session.user.id);
      loadSubscription(session.user.email);
      loadCategories(session.user.id);
      loadExpenses(session.user.id);
      logLogin(session.user.email);
      logPageView(session.user.id);
    }
  }, [session]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (sessionIdRef.current && sessionStartRef.current) {
        const duration = Math.floor((Date.now() - sessionStartRef.current) / 1000);
        navigator.sendBeacon(
          `${process.env.REACT_APP_SUPABASE_URL}/rest/v1/user_sessions?id=eq.${sessionIdRef.current}`,
          JSON.stringify({ duration_seconds: duration })
        );
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const startSession = async (userId) => {
    try {
      const { data: existingSession } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', userId)
        .is('session_end', null)
        .maybeSingle();

      if (existingSession) {
        sessionIdRef.current = existingSession.id;
        sessionStartRef.current = new Date(existingSession.session_start).getTime();
        updateSessionActivity(existingSession.id);
      } else {
        const { data: newSession } = await supabase
          .from('user_sessions')
          .insert({
            user_id: userId,
            email: session?.user?.email || '',
            session_start: new Date().toISOString(),
            last_activity: new Date().toISOString(),
            device_info: {
              platform: navigator.platform,
              user_agent: navigator.userAgent,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
            }
          })
          .select()
          .single();

        if (newSession) {
          sessionIdRef.current = newSession.id;
          sessionStartRef.current = Date.now();
        }
      }

      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        if (sessionIdRef.current) {
          updateSessionActivity(sessionIdRef.current);
        }
      }, 30000);
    } catch (error) {
      console.error('Session start error:', error);
    }
  };

  const updateSessionActivity = async (sessionId) => {
    try {
      await supabase
        .from('user_sessions')
        .update({ last_activity: new Date().toISOString() })
        .eq('id', sessionId);
    } catch (error) {
      console.error('Activity update error:', error);
    }
  };

  const logLogin = async (email) => {
    try {
      await supabase.from('login_logs').insert({
        email,
        login_time: new Date().toISOString(),
        device_info: {
          platform: navigator.platform,
          user_agent: navigator.userAgent
        }
      });
      console.log('App: login tracked for', email);
    } catch (error) {
      console.error('Login log error:', error);
    }
  };

  const logPageView = async (userId) => {
    try {
      await supabase.from('page_views').insert({
        user_id: userId,
        page_url: window.location.pathname,
        view_time: new Date().toISOString()
      });
    } catch (error) {
      console.error('Page view log error:', error);
    }
  };

  const loadUserRole = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('preferences_value')
        .eq('user_id', userId)
        .eq('preferences_type', 'role')
        .maybeSingle();

      if (error) throw error;
      setUserRole(data?.preferences_value || 'user');
    } catch (error) {
      console.error('Load role error:', error);
      setUserRole('user');
    }
  };

  const loadUserProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('preferences_type, preferences_value')
        .eq('user_id', userId)
        .in('preferences_type', ['display_name', 'title']);

      if (error) throw error;
      
      const profile = {};
      data?.forEach(pref => {
        profile[pref.preferences_type] = pref.preferences_value;
      });
      
      setUserProfile(profile);
    } catch (error) {
      console.error('Load profile error:', error);
    }
  };

  const loadSubscription = async (email) => {
    try {
      const ceoTestEmails = ['lifeliftusa@gmail.com', 'test@example.com'];
      if (ceoTestEmails.includes(email)) {
        setSubscriptionStatus('pro');
        return;
      }

      const { data, error } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('email', email)
        .maybeSingle();

      if (error) throw error;
      setSubscriptionStatus(data?.status || 'free');
    } catch (error) {
      console.error('Load subscription error:', error);
      setSubscriptionStatus('free');
    }
  };

  const loadCategories = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Load categories error:', error);
    }
  };

  const loadExpenses = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', userId)
        .order('spent_at', { ascending: false });

      if (error) throw error;
      
      setExpenses(data || []);
      updateMerchantMemory(data || []);
    } catch (error) {
      console.error('Load expenses error:', error);
    }
  };

  const updateMerchantMemory = (expensesList) => {
    const memory = new Map();
    expensesList.forEach(expense => {
      if (expense.merchant && expense.category) {
        memory.set(expense.merchant.toLowerCase(), expense.category);
      }
    });
    merchantMemoryRef.current = memory;
  };

  const suggestCategoryForMerchant = async (merchantName) => {
    const cached = merchantMemoryRef.current.get(merchantName.toLowerCase());
    if (cached) return cached;

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
            role: 'user',
            content: `Suggest a category for this merchant: ${merchantName}. Reply with just the category name (e.g., "Groceries", "Transportation", "Entertainment").`
          }],
          temperature: 0.3,
          max_tokens: 20
        })
      });

      const result = await response.json();
      const suggestion = result.choices?.[0]?.message?.content?.trim() || 'Uncategorized';
      merchantMemoryRef.current.set(merchantName.toLowerCase(), suggestion);
      return suggestion;
    } catch (error) {
      console.error('Category suggestion error:', error);
      return 'Uncategorized';
    }
  };

  const handleLogin = async (email, password) => {
    try {
      setLoginStatus('Signing in...');
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setLoginStatus('Login successful!');
      setSession(data.session);
    } catch (error) {
      console.error('Login error:', error);
      setLoginStatus(`Login failed: ${error.message}`);
    }
  };

  const handleLogout = async () => {
    try {
      if (sessionIdRef.current && sessionStartRef.current) {
        const duration = Math.floor((Date.now() - sessionStartRef.current) / 1000);
        await supabase
          .from('user_sessions')
          .update({
            session_end: new Date().toISOString(),
            duration_seconds: duration
          })
          .eq('id', sessionIdRef.current);
      }

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      await supabase.auth.signOut();
      setSession(null);
      setExpenses([]);
      setCategories([]);
      sessionIdRef.current = null;
      sessionStartRef.current = null;
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const addExpense = async (expenseData) => {
    try {
      let receiptUrl = null;

      if (expenseData.receipt) {
        const fileName = `${Date.now()}_${expenseData.receipt.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(fileName, expenseData.receipt);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('receipts')
          .getPublicUrl(fileName);

        receiptUrl = urlData.publicUrl;
      }

      let location = null;
      if (navigator.geolocation) {
        try {
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject);
          });

          const { latitude, longitude } = position.coords;
          const geoResponse = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
          );
          const geoData = await geoResponse.json();
          location = geoData.display_name || `${latitude}, ${longitude}`;
        } catch (geoError) {
          console.log('Geolocation error:', geoError);
        }
      }

      const newExpense = {
        user_id: session.user.id,
        amount: parseFloat(expenseData.amount),
        merchant: expenseData.merchant,
        category_id: expenseData.category,
        spent_at: expenseData.date || new Date().toISOString(),
        payment_method: expenseData.paymentMethod,
        note: expenseData.notes || '',
        receipt_image_url: receiptUrl,
        location: location,
        archived: false
      };

      const { error } = await supabase.from('expenses').insert([newExpense]);

      if (error) throw error;

      await loadExpenses(session.user.id);
    } catch (error) {
      console.error('Add expense error:', error);
      alert(`Failed to add expense: ${error.message}`);
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
      console.error('Update expense error:', error);
    }
  };

  const archiveExpense = async (id) => {
    try {
      const expense = expenses.find(e => e.id === id);
      setPendingUndo({ action: 'archive', expense });

      const { error } = await supabase
        .from('expenses')
        .update({ archived: true })
        .eq('id', id);

      if (error) throw error;
      await loadExpenses(session.user.id);

      setTimeout(() => setPendingUndo(null), 5000);
    } catch (error) {
      console.error('Archive expense error:', error);
    }
  };

  const deleteExpense = async (id) => {
    try {
      const expense = expenses.find(e => e.id === id);
      setPendingUndo({ action: 'delete', expense });

      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadExpenses(session.user.id);

      setTimeout(() => setPendingUndo(null), 5000);
    } catch (error) {
      console.error('Delete expense error:', error);
    }
  };

  const undoAction = async () => {
    if (!pendingUndo) return;

    try {
      if (pendingUndo.action === 'archive') {
        const { error } = await supabase
          .from('expenses')
          .update({ archived: false })
          .eq('id', pendingUndo.expense.id);

        if (error) throw error;
      } else if (pendingUndo.action === 'delete') {
        const { error } = await supabase
          .from('expenses')
          .insert([pendingUndo.expense]);

        if (error) throw error;
      }

      await loadExpenses(session.user.id);
      setPendingUndo(null);
    } catch (error) {
      console.error('Undo error:', error);
    }
  };

  const openReceipt = (url) => {
    window.open(url, '_blank');
  };

  const handleImportComplete = (transactions) => {
    setParsedTransactions(transactions);
  };

  const handleImportConfirm = async (confirmedTransactions) => {
    try {
      const expensesToInsert = confirmedTransactions.map(t => ({
        user_id: session.user.id,
        amount: parseFloat(t.amount),
        merchant: t.merchant,
        category_id: t.category,
        spent_at: t.date,
        payment_method: t.paymentMethod || 'Unknown',
        note: t.notes || '',
        archived: false
      }));

      const { error } = await supabase.from('expenses').insert(expensesToInsert);

      if (error) throw error;

      await loadExpenses(session.user.id);
      setParsedTransactions([]);
      setShowImport(false);
      alert('Import successful!');
    } catch (error) {
      console.error('Import confirm error:', error);
      alert(`Import failed: ${error.message}`);
    }
  };

  const handleImportCancel = () => {
    setParsedTransactions([]);
    setShowImport(false);
  };

  const handleExport = () => {
    try {
      const csvHeader = 'Date,Merchant,Category,Amount,Payment Method,Notes\n';
      const csvRows = filteredExpenses.map(e => 
        `${e.spent_at},${e.merchant},${e.category},${e.amount},${e.payment_method || ''},${e.note || ''}`
      ).join('\n');

      const csvContent = csvHeader + csvRows;
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `expenses_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
    }
  };

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const processReceiptWithOCR = async (file) => {
    try {
      const base64Image = await fileToBase64(file);

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
                text: 'Extract the following from this receipt: merchant name, total amount, date, and line items. Return as JSON: {"merchant": "", "amount": 0, "date": "", "items": []}'
              },
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${base64Image}` }
              }
            ]
          }],
          max_tokens: 500
        })
      });

      const result = await response.json();
      const content = result.choices?.[0]?.message?.content || '{}';
      
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const parsedData = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

      return parsedData;
    } catch (error) {
      console.error('OCR processing error:', error);
      throw error;
    }
  };

  const parseNaturalDate = (dateStr) => {
    const today = new Date();
    const lower = dateStr.toLowerCase();

    if (lower === 'today') return today.toISOString().split('T')[0];
    if (lower === 'yesterday') {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday.toISOString().split('T')[0];
    }

    return dateStr;
  };

  const handleAICommand = async (command) => {
    try {
      if (command.action === 'add_expense') {
        await addExpense({
          amount: command.amount,
          merchant: command.merchant,
          category: command.category || await suggestCategoryForMerchant(command.merchant),
          date: parseNaturalDate(command.date || new Date().toISOString()),
          paymentMethod: command.payment_method || 'Unknown',
          notes: command.notes || ''
        });
        return { success: true, message: 'Expense added successfully' };
      }

      if (command.action === 'update_expense') {
        await updateExpense(command.id, command.updates);
        return { success: true, message: 'Expense updated successfully' };
      }

      if (command.action === 'search') {
        setSearchTerm(command.query);
        return { success: true, results: filteredExpenses };
      }

      if (command.action === 'export') {
        handleExport();
        return { success: true, message: 'Export started' };
      }

      return { success: false, message: 'Unknown command' };
    } catch (error) {
      console.error('AI command error:', error);
      return { success: false, message: error.message };
    }
  };

  const calculateAIInsights = () => {
    if (!isProMode) return null;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const thisMonthExpenses = expenses.filter(e => {
      const expenseDate = new Date(e.spent_at);
      return expenseDate.getMonth() === currentMonth && 
             expenseDate.getFullYear() === currentYear &&
             !e.archived;
    });

    const total = thisMonthExpenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
    const avgDaily = total / now.getDate();
    const daysLeft = new Date(currentYear, currentMonth + 1, 0).getDate() - now.getDate();
    const forecastTotal = total + (avgDaily * daysLeft);

    const merchantCounts = {};
    thisMonthExpenses.forEach(e => {
      merchantCounts[e.merchant] = (merchantCounts[e.merchant] || 0) + 1;
    });
    const recurringMerchants = Object.entries(merchantCounts)
      .filter(([_, count]) => count >= 2)
      .map(([merchant]) => merchant);

    const categoryTotals = {};
    thisMonthExpenses.forEach(e => {
      categoryTotals[e.category] = (categoryTotals[e.category] || 0) + parseFloat(e.amount || 0);
    });
    const topCategories = Object.entries(categoryTotals)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([cat, amt]) => ({ category: cat, amount: amt }));

    return {
      forecastTotal: forecastTotal.toFixed(2),
      recurringMerchants,
      topCategories
    };
  };

  const aiInsights = calculateAIInsights();
  const isAdmin = userRole === 'admin' || session?.user?.email === 'lifeliftusa@gmail.com';

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p>Loading...</p>
      </div>
    );
  }

  if (!session) {
    return <Login onLogin={handleLogin} status={loginStatus} />;
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Nova Expense Tracker</h1>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {isAdmin && (
            <>
              <button 
                onClick={() => setTestMode(!testMode)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: testMode ? '#6c757d' : '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                {testMode ? 'Basic Mode' : 'PRO Mode'}
              </button>
              <button onClick={() => navigate('/login-history')} style={{ padding: '8px 16px', cursor: 'pointer' }}>
                Login History
              </button>
              <button onClick={() => navigate('/analytics')} style={{ padding: '8px 16px', cursor: 'pointer' }}>
                Analytics
              </button>
            </>
          )}
          <button onClick={() => setShowImport(true)} style={{ padding: '8px 16px', cursor: 'pointer' }}>
            Import
          </button>
          <button onClick={handleExport} style={{ padding: '8px 16px', cursor: 'pointer' }}>
            Export
          </button>
          <button onClick={handleLogout} style={{ padding: '8px 16px', cursor: 'pointer' }}>
            Logout
          </button>
        </div>
      </div>

      {userProfile && (
        <p style={{ marginBottom: '20px', fontSize: '18px', color: '#333' }}>
          <strong>Hello, {userProfile.display_name || session.user.email}</strong>
          {userProfile.title && <span style={{ color: '#666' }}> - {userProfile.title}</span>}
        </p>
      )}

      {pendingUndo && (
        <div style={{ 
          padding: '10px', 
          backgroundColor: '#fff3cd', 
          marginBottom: '20px',
          borderRadius: '4px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>Expense {pendingUndo.action}d</span>
          <button onClick={undoAction} style={{ padding: '5px 15px', cursor: 'pointer' }}>
            Undo
          </button>
        </div>
      )}

      {session?.user && (
        <div style={{ marginBottom: '20px', width: '100%' }}>
          <ChatAssistant 
            userId={session?.user?.id}
            userProfile={userProfile}
            onCommand={handleAICommand}
            expenses={expenses}
          />
        </div>
      )}

      {isProMode && aiInsights && (
        <div style={{ 
          padding: '20px', 
          backgroundColor: '#e7f3ff', 
          marginBottom: '20px',
          borderRadius: '8px'
        }}>
          <h3>AI Insights (PRO)</h3>
          <p><strong>Forecast Total:</strong> ${aiInsights.forecastTotal}</p>
          <p><strong>Recurring Merchants:</strong> {aiInsights.recurringMerchants.join(', ') || 'None'}</p>
          <div>
            <strong>Top Categories:</strong>
            {aiInsights.topCategories.map((cat, i) => (
              <div key={i}>• {cat.category}: ${cat.amount.toFixed(2)}</div>
            ))}
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
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '8px',
            maxWidth: '400px'
          }}>
            <h2>Upgrade to PRO</h2>
            <p>Get AI insights, advanced analytics, and more for $9.99/month</p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button 
                onClick={() => {
                  alert('Stripe integration coming soon!');
                  setShowUpgrade(false);
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Upgrade Now
              </button>
              <button 
                onClick={() => setShowUpgrade(false)}
                style={{ padding: '10px 20px', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showImport && (
        <div style={{ marginBottom: '20px' }}>
          <FileImport
            onImportComplete={handleImportComplete}
            onProcessReceipt={processReceiptWithOCR}
          />
          <button 
            onClick={() => setShowImport(false)}
            style={{ marginTop: '10px', padding: '8px 16px', cursor: 'pointer' }}
          >
            Close Import
          </button>
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
      />

      <MonthlySummary expenses={allExpenses} />

      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Search expenses..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ 
            width: '100%', 
            padding: '10px',
            fontSize: '16px',
            border: '1px solid #ddd',
            borderRadius: '4px'
          }}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Show Archived Expenses
        </label>
      </div>

      <ExpenseList
        expenses={filteredExpenses}
        onUpdate={updateExpense}
        onArchive={archiveExpense}
        onDelete={deleteExpense}
        onOpenReceipt={openReceipt}
        categories={categories}
      />
    </div>
  );
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
  );
}

export default App;
