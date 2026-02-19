import { useState, useCallback, useRef } from 'react'
import { supabase } from '../supabaseClient'

export function useExpenses(userId) {
  const [expenses, setExpenses] = useState([])
  const [pendingUndo, setPendingUndo] = useState(null)
  const [loading, setLoading] = useState(false)
  
  const merchantMemoryRef = useRef({})

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

      setTimeout(() => {
        setPendingUndo(null)
      }, 5000)

      return { success: true }
    } catch (err) {
      console.error('Archive error:', err)
      return { success: false, error: err.message }
    }
  }, [expenses, userId, loadExpenses])

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

      setTimeout(() => {
        setPendingUndo(null)
      }, 5000)

      return { success: true }
    } catch (err) {
      console.error('Delete error:', err)
      return { success: false, error: err.message }
    }
  }, [expenses, userId, loadExpenses])

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

  const getCategorySuggestion = useCallback((merchant) => {
    if (!merchant) return null
    return merchantMemoryRef.current[merchant.toLowerCase()] || null
  }, [])

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
      const key = `${e.merchant}|${e.amount}`
      merchantCounts[key] = (merchantCounts[key] || 0) + 1
    })
    const trueDuplicates = Object.entries(merchantCounts)
      .filter(([key, count]) => {
        const [merchant] = key.split('|')
        const lower = merchant.toLowerCase()
        const isCommonRepeat = ['starbucks', 'coffee', 'gas', 'lotto', 'lottery', 'uber', 'lyft', 'parking'].some(w => lower.includes(w))
        return count >= 3 || (count >= 2 && !isCommonRepeat)
      })
      .map(([key, count]) => {
        const [merchant, amount] = key.split('|')
        return { merchant, amount: parseFloat(amount), count }
      })

    const recurringMerchants = Object.entries(
      thisMonthExpenses.reduce((acc, e) => {
        acc[e.merchant] = (acc[e.merchant] || 0) + 1
        return acc
      }, {})
    )
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
      topCategories,
      trueDuplicates
    }
  }, [])

  return {
    expenses,
    pendingUndo,
    loading,
    loadExpenses,
    updateExpense,
    archiveExpense,
    deleteExpense,
    undoAction,
    getCategorySuggestion,
    calculateAIInsights,
    setPendingUndo
  }
}