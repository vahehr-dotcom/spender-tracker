import React, { useState } from 'react'
import { supabase } from '../supabaseClient'

function getNowLocalDateTime() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

export default function AddExpenseForm({ categories, mainCategories = [], onAddExpense, isProMode, onUpgradeToPro, userId }) {
  const [amount, setAmount] = useState('')
  const [merchant, setMerchant] = useState('')
  const [spentAtLocal, setSpentAtLocal] = useState(getNowLocalDateTime())
  const [paymentMethod, setPaymentMethod] = useState('card')
  const [categoryId, setCategoryId] = useState('')
  const [notes, setNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryParent, setNewCategoryParent] = useState('')

  const handleSave = async () => {
    if (!amount || !merchant || !categoryId) {
      alert('Please fill in Amount, Merchant, and Category')
      return
    }

    setIsSaving(true)
    setSaveSuccess(false)

    const expense = {
      amount: parseFloat(amount),
      merchant,
      category_id: categoryId,
      spent_at: new Date(spentAtLocal).toISOString(),
      payment_method: paymentMethod,
      note: notes || null
    }

    const result = await onAddExpense(expense)

    if (result.success) {
      setSaveSuccess(true)
      setAmount('')
      setMerchant('')
      setSpentAtLocal(getNowLocalDateTime())
      setCategoryId('')
      setNotes('')
      setTimeout(() => setSaveSuccess(false), 2000)
    } else {
      alert('Failed to save: ' + (result.error || 'Unknown error'))
    }

    setIsSaving(false)
  }

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return

    try {
      const { data, error } = await supabase
        .from('categories')
        .insert({
          user_id: userId,
          name: newCategoryName.trim(),
          is_custom: true,
          parent_id: newCategoryParent || null
        })
        .select()
        .single()

      if (error) throw error

      setNewCategoryName('')
      setNewCategoryParent('')
      setShowAddCategory(false)
      setCategoryId(data.id)
      window.location.reload()
    } catch (err) {
      alert('Failed to add category: ' + err.message)
    }
  }

  const customCategoryCount = categories.filter(c => c.is_custom && c.user_id === userId).length
  const canAddCategory = isProMode || customCategoryCount < 3

  const hasGroupedCategories = mainCategories && mainCategories.length > 0

  return (
    <div>
      <h3 style={{ marginTop: 0, marginBottom: '20px' }}>Add Expense</h3>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
          Amount <span style={{ color: 'red' }}>*</span>
        </label>
        <input
          type="number"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="42.50"
          style={{
            width: '100%',
            padding: '10px',
            fontSize: '16px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            boxSizing: 'border-box'
          }}
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
          Merchant <span style={{ color: 'red' }}>*</span>
        </label>
        <input
          type="text"
          value={merchant}
          onChange={(e) => setMerchant(e.target.value)}
          placeholder="e.g., Starbucks"
          style={{
            width: '100%',
            padding: '10px',
            fontSize: '16px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            boxSizing: 'border-box'
          }}
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
          Date & Time <span style={{ color: 'red' }}>*</span>
        </label>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="datetime-local"
            value={spentAtLocal}
            onChange={(e) => setSpentAtLocal(e.target.value)}
            style={{
              flex: 1,
              padding: '10px',
              fontSize: '16px',
              border: '1px solid #ddd',
              borderRadius: '8px'
            }}
          />
          <button
            onClick={() => setSpentAtLocal(getNowLocalDateTime())}
            style={{
              padding: '10px 15px',
              border: '1px solid #667eea',
              borderRadius: '8px',
              background: 'white',
              color: '#667eea',
              cursor: 'pointer'
            }}
          >
            Now
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
          Category <span style={{ color: 'red' }}>*</span>
        </label>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          style={{
            width: '100%',
            padding: '10px',
            fontSize: '16px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            boxSizing: 'border-box'
          }}
        >
          <option value="">-- Select Category --</option>
          {hasGroupedCategories ? (
            mainCategories.map((main) => (
              <optgroup key={main.id} label={main.name}>
                <option value={main.id}>{main.name} (General)</option>
                {main.subcategories && main.subcategories.map((sub) => (
                  <option key={sub.id} value={sub.id}>{sub.name}</option>
                ))}
              </optgroup>
            ))
          ) : (
            categories.filter(c => c.parent_id === null).map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))
          )}
        </select>

        <div style={{ marginTop: '10px' }}>
          {canAddCategory ? (
            <button
              onClick={() => setShowAddCategory(true)}
              style={{
                padding: '8px 12px',
                border: '1px solid #667eea',
                borderRadius: '8px',
                background: 'white',
                color: '#667eea',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              + Add Custom Category
            </button>
          ) : (
            <div style={{ fontSize: '14px', color: '#666' }}>
              <span style={{ color: '#ef4444' }}>3 custom categories limit reached</span>
              <button
                onClick={onUpgradeToPro}
                style={{
                  marginLeft: '10px',
                  padding: '6px 12px',
                  border: 'none',
                  borderRadius: '6px',
                  background: '#f59e0b',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '13px'
                }}
              >
                Upgrade for unlimited
              </button>
            </div>
          )}
        </div>

        {showAddCategory && (
          <div style={{
            marginTop: '15px',
            padding: '15px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            background: '#f9fafb'
          }}>
            <select
              value={newCategoryParent}
              onChange={(e) => setNewCategoryParent(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '14px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                marginBottom: '10px',
                boxSizing: 'border-box'
              }}
            >
              <option value="">Add as main category</option>
              {mainCategories.map(main => (
                <option key={main.id} value={main.id}>Add under: {main.name}</option>
              ))}
            </select>
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Category name"
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '14px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                marginBottom: '10px',
                boxSizing: 'border-box'
              }}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={handleAddCategory}
                style={{
                  padding: '8px 15px',
                  border: 'none',
                  borderRadius: '6px',
                  background: '#10b981',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Save
              </button>
              <button
                onClick={() => { setShowAddCategory(false); setNewCategoryParent('') }}
                style={{
                  padding: '8px 15px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  background: 'white',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
          Payment Method <span style={{ color: 'red' }}>*</span>
        </label>
        <select
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
          style={{
            width: '100%',
            padding: '10px',
            fontSize: '16px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            boxSizing: 'border-box'
          }}
        >
          <option value="card">Card</option>
          <option value="cash">Cash</option>
          <option value="apple_pay">Apple Pay</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
          Notes <span style={{ fontSize: '14px', color: '#666' }}>(optional)</span>
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add any notes..."
          style={{
            width: '100%',
            padding: '10px',
            fontSize: '14px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            boxSizing: 'border-box',
            minHeight: '60px',
            resize: 'vertical'
          }}
        />
      </div>

      <button
        onClick={handleSave}
        disabled={isSaving}
        style={{
          width: '100%',
          padding: '15px',
          fontSize: '18px',
          fontWeight: 'bold',
          border: 'none',
          borderRadius: '8px',
          cursor: isSaving ? 'not-allowed' : 'pointer',
          background: isSaving ? '#9ca3af' : saveSuccess ? '#10b981' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white'
        }}
      >
        {isSaving ? 'Saving...' : saveSuccess ? '✓ Saved!' : 'Add Expense'}
      </button>
    </div>
  )
}