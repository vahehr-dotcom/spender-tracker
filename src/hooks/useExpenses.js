import { useState, useCallback, useRef } from 'react'
import { supabase } from '../supabaseClient'

export function useExpenses(userId) {
  const [expenses, setExpenses] = useState([])
  const [pendingUndo, setPendingUndo] = useState(null)
  const [loading, setLoading] = useState(false)
  
  const merchantMemoryRef = useRef({})

  // Load all expenses for user
  const loadExpenses = useCallback(async (uid = userId) => {
    if (!uid) return []
    
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', uid)
        .order('spent_at', { ascending: false })

      if (error) throw error

      setExpenses(data || [])

      // Build merchant memory for category suggestions
      data?.forEach(expense => {
        if (expense.merchant && expense.category_id) {
          merchantMemoryRef.current[expense.merchant.toLowerCase()] = expense.category_id
        }
      })

      setLoading(false)
      return data || []
    } catch (err) {
      console.error('Load expenses error:', err)
      setLoading(false)
      return []
    }
  }, [userId])

  // Add new expense
  const addExpense = useCallback(async (expense, uid = userId) => {
    if (!uid) return { success: false, error: 'No user ID' }

    try {
      let receiptUrl = null

      // Upload receipt if provided
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

      // Get location if available
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
        user_id: uid,
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

      await loadExpenses(uid)
      return { success: true }
    } catch (err) {
      console.error('Add expense error:', err)
      return { success: false, error: err.message }
    }
  }, [userId, loadExpenses])

  // Update existing expense
  const updateExpense = useCallback(async (id, updates, uid = userId) => {
    try {
      const { error } = await supabase
        .from('expenses')
        .update(updates)
        .eq('id', id)

      if (error) throw error

      await loadExpenses(uid)
      return { success: true }
    } catch (err) {
      console.error('Update expense error:', err)
      return { success: false, error: err.message }
    }
  }, [userId, loadExpenses])

  // Archive expense (soft delete)
  const archiveExpense = useCallback(async (id, uid = userId) => {
    const expense = expenses.find(e => e.id === id)
    if (!expense) return { success: false, error: 'Expense not found' }

    try {
      const { error } = await supabase
        .from('expenses')
        .update({ archived: true })
        .eq('id', id)

      if (error) throw error

      setPendingUndo({ action: 'archive', expense })
      await loadExpenses(uid)

      // Clear undo after 5 seconds
      setTimeout(() => {
        setPendingUndo(null)
      }, 5000)

      return { success: true }
    } catch (err) {
      console.error('Archive error:', err)
      return { success: false, error: err.message }
    }
  }, [expenses, userId, loadExpenses])

  // Permanently delete expense
  const deleteExpense = useCallback(async (id, uid = userId) => {
    const expense = expenses.find(e => e.id === id)
    if (!expense) return { success: false, error: 'Expense not found' }

    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id)

      if (error) throw error

      setPendingUndo({ action: 'delete', expense })
      await loadExpenses(uid)

      // Clear undo after 5 seconds
      setTimeout(() => {
        setPendingUndo(null)
      }, 5000)

      return { success: true }
    } catch (err) {
      console.error('Delete error:', err)
      return { success: false, error: err.message }
    }
  }, [expenses, userId, loadExpenses])

  // Undo last archive/delete
  const undoAction = useCallback(async (uid = userId) => {
    if (!pendingUndo) return { success: false, error: 'Nothing to undo' }

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
      await loadExpenses(uid)
      return { success: true }
    } catch (err) {
      console.error('Undo error:', err)
      return { success: false, error: err.message }
    }
  }, [pendingUndo, userId, loadExpenses])

  // Get category suggestion based on merchant
  const getCategorySuggestion = useCallback((merchant) => {
    if (!merchant) return null
    return merchantMemoryRef.current[merchant.toLowerCase()] || null
  }, [])

  // Calculate AI insights for PRO users
  const calculateAIInsights = useCallback((allExpenses, categories) => {
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
  }, [])

  return {
    expenses,
    pendingUndo,
    loading,
    loadExpenses,
    addExpense,
    updateExpense,
    archiveExpense,
    deleteExpense,
    undoAction,
    getCategorySuggestion,
    calculateAIInsights,
    setPendingUndo
  }
}