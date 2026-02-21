import { useState } from 'react'
import { supabase } from '../supabaseClient'
import CategoryPicker from './CategoryPicker'
import CategoryResolver from '../lib/CategoryResolver'

export default function ExpenseList({
  expenses,
  categories,
  mainCategories = [],
  isProMode,
  onUpdate,
  onArchive,
  onDelete,
  onOpenReceipt,
  userId
}) {
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [receiptModal, setReceiptModal] = useState(null)
  const [editReceipt, setEditReceipt] = useState(null)
  const [editReceiptPreview, setEditReceiptPreview] = useState(null)

  const categoryName = (id) => {
    const c = categories.find(x => x.id === id)
    return c ? c.name : '—'
  }

  const toLocalDatetimeString = (dateStr) => {
    const d = new Date(dateStr)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }

  const toLocalISOString = (dateStr) => {
    const d = new Date(dateStr)
    const offset = -d.getTimezoneOffset()
    const sign = offset >= 0 ? '+' : '-'
    const hrs = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0')
    const mins = String(Math.abs(offset) % 60).padStart(2, '0')
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    const seconds = String(d.getSeconds()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${hrs}:${mins}`
  }

  const startEdit = (expense) => {
    setEditingId(expense.id)
    setEditReceipt(null)
    setEditReceiptPreview(null)
    setEditForm({
      amount: Number(expense.amount).toFixed(2),
      merchant: expense.merchant,
      description: expense.description || '',
      category_id: expense.category_id || '',
      original_category_id: expense.category_id || '',
      payment_method: expense.payment_method,
      spent_at: toLocalDatetimeString(expense.spent_at),
      is_tax_deductible: expense.is_tax_deductible || false,
      is_reimbursable: expense.is_reimbursable || false,
      employer_or_client: expense.employer_or_client || '',
      notes: expense.notes || '',
      tags: (expense.tags || []).join(', '),
      receipt_image_url: expense.receipt_image_url || null
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditForm({})
    setEditReceipt(null)
    setEditReceiptPreview(null)
  }

  const handleEditReceiptChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setEditReceipt(file)
      const reader = new FileReader()
      reader.onload = (ev) => setEditReceiptPreview(ev.target.result)
      reader.readAsDataURL(file)
    }
  }

  const uploadEditReceipt = async () => {
    if (!editReceipt || !userId) return null
    try {
      const fileName = `${userId}/${Date.now()}_${editReceipt.name}`
      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(fileName, editReceipt)

      if (uploadError) {
        console.error('Receipt upload error:', uploadError)
        return null
      }

      const { data: urlData } = supabase.storage
        .from('receipts')
        .getPublicUrl(fileName)

      return urlData.publicUrl
    } catch (err) {
      console.error('Receipt upload exception:', err)
      return null
    }
  }

  const saveEdit = async (expenseId) => {
    let receiptUrl = editForm.receipt_image_url
    if (editReceipt) {
      const uploaded = await uploadEditReceipt()
      if (uploaded) receiptUrl = uploaded
    }

    const updated = {
      amount: parseFloat(editForm.amount),
      merchant: editForm.merchant,
      description: editForm.description || null,
      category_id: editForm.category_id || null,
      payment_method: editForm.payment_method,
      spent_at: toLocalISOString(editForm.spent_at),
      is_tax_deductible: editForm.is_tax_deductible,
      is_reimbursable: editForm.is_reimbursable,
      employer_or_client: editForm.employer_or_client || null,
      notes: editForm.notes || null,
      tags: editForm.tags ? editForm.tags.split(',').map(t => t.trim()).filter(Boolean) : null,
      receipt_image_url: receiptUrl
    }

    await onUpdate(expenseId, updated)

    // Learning loop: if user changed the category, record the correction
    if (editForm.category_id !== editForm.original_category_id && editForm.merchant && userId) {
      const newCatName = categoryName(editForm.category_id)
      if (newCatName && newCatName !== '—') {
        console.log('🧠 Learning: user corrected', editForm.merchant, '→', newCatName)
        CategoryResolver.recordCorrection(userId, editForm.merchant, newCatName).catch(() => {})
        CategoryResolver.log(
          userId, expenseId, editForm.merchant,
          newCatName, 'user_correction', 1.0
        ).catch(() => {})
      }
    }

    setEditingId(null)
    setEditForm({})
    setEditReceipt(null)
    setEditReceiptPreview(null)
  }

  const handleDelete = (id, merchant, amount) => {
    if (window.confirm(`Permanently delete $${amount} at ${merchant}? This cannot be undone.`)) {
      onDelete(id)
    }
  }

  const getLocationLabel = (location) => {
    if (!location) return null
    try {
      if (typeof location === 'object') {
        return location.label || `${location.lat}, ${location.lng}`
      }
      const parsed = JSON.parse(location)
      return parsed.label || `${parsed.lat}, ${parsed.lng}`
    } catch (e) {
      return location
    }
  }

  if (!expenses || expenses.length === 0) {
    return (
      <div>
        <p style={{ opacity: 0.7 }}>No expenses yet. Add your first one above!</p>
      </div>
    )
  }

  return (
    <div>
      {expenses.map(e => {
        const isEditing = editingId === e.id
        const locationLabel = getLocationLabel(e.location)

        return (
          <div
            key={e.id}
            style={{
              border: '1px solid #ddd',
              borderRadius: 10,
              padding: 12,
              marginBottom: 12,
              backgroundColor: isEditing ? '#FFF9E6' : e.archived ? '#f5f5f5' : 'white'
            }}
          >
            {!isEditing ? (
              <>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ fontSize: 18, fontWeight: 600 }}>
                    ${Number(e.amount).toFixed(2)} — {e.merchant}
                    {e.description && (
                      <span style={{ fontSize: 14, fontWeight: 400, color: '#666', marginLeft: 8 }}>
                        ({e.description})
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button onClick={() => startEdit(e)} style={btnStyle}>✏️ Edit</button>

                    {e.receipt_image_url && (
                      <button onClick={() => setReceiptModal(e.receipt_image_url)} style={btnStyle}>📎 Receipt</button>
                    )}

                    {!e.archived && (
                      <button onClick={() => onArchive(e.id)} style={btnStyle}>📦 Archive</button>
                    )}

                    <button
                      onClick={() => handleDelete(e.id, e.merchant, Number(e.amount).toFixed(2))}
                      style={{ ...btnStyle, backgroundColor: '#FF5252', color: 'white' }}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>

                <div style={{ marginTop: 6, opacity: 0.7, fontSize: 14 }}>
                  {categoryName(e.category_id)} • {e.payment_method} • {new Date(e.spent_at).toLocaleString()}
                </div>

                {locationLabel && (
                  <div style={{ marginTop: 6, opacity: 0.7, fontSize: 14 }}>
                    📍 {locationLabel}
                  </div>
                )}

                {(e.is_tax_deductible || e.is_reimbursable) && (
                  <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {e.is_tax_deductible && <span style={pillStyle}>💼 Tax Deductible</span>}
                    {e.is_reimbursable && (
                      <span style={pillStyle}>
                        💰 Reimbursable{e.employer_or_client ? `: ${e.employer_or_client}` : ''}
                      </span>
                    )}
                  </div>
                )}

                {e.tags && e.tags.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 14 }}>
                    <strong>Tags:</strong> {e.tags.join(', ')}
                  </div>
                )}

                {e.notes && (
                  <div style={{ marginTop: 8, fontSize: 14, opacity: 0.8 }}>
                    <strong>Note:</strong> {e.notes}
                  </div>
                )}
              </>
            ) : (
              <div style={{ padding: 10 }}>
                <h4 style={{ marginTop: 0, marginBottom: 15 }}>✏️ Edit Expense</h4>

                <div style={fieldStyle}>
                  <label style={labelStyle}>Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.amount}
                    onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                    style={inputStyle}
                  />
                </div>

                <div style={fieldStyle}>
                  <label style={labelStyle}>Paid to</label>
                  <input
                    type="text"
                    value={editForm.merchant}
                    onChange={(e) => setEditForm({ ...editForm, merchant: e.target.value })}
                    style={inputStyle}
                  />
                </div>

                <div style={fieldStyle}>
                  <label style={labelStyle}>Item / Description</label>
                  <input
                    type="text"
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    placeholder="e.g., Men's cologne, Large iced latte"
                    style={inputStyle}
                  />
                </div>

                <div style={fieldStyle}>
                  <label style={labelStyle}>Category</label>
                  <CategoryPicker
                    categories={categories}
                    mainCategories={mainCategories}
                    value={editForm.category_id}
                    onChange={(id) => setEditForm({ ...editForm, category_id: id })}
                  />
                </div>

                <div style={fieldStyle}>
                  <label style={labelStyle}>Payment Method</label>
                  <select
                    value={editForm.payment_method}
                    onChange={(e) => setEditForm({ ...editForm, payment_method: e.target.value })}
                    style={inputStyle}
                  >
                    <option value="card">Card</option>
                    <option value="cash">Cash</option>
                    <option value="apple_pay">Apple Pay</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div style={fieldStyle}>
                  <label style={labelStyle}>Date & Time</label>
                  <input
                    type="datetime-local"
                    value={editForm.spent_at}
                    onChange={(e) => setEditForm({ ...editForm, spent_at: e.target.value })}
                    style={inputStyle}
                  />
                </div>

                <div style={fieldStyle}>
                  <label style={labelStyle}>Receipt</label>
                  {editForm.receipt_image_url && !editReceiptPreview && (
                    <div style={{ marginBottom: 8 }}>
                      <span style={{ fontSize: 13, color: '#666' }}>📎 Current receipt attached</span>
                      <button
                        onClick={() => setReceiptModal(editForm.receipt_image_url)}
                        style={{ ...btnStyle, marginLeft: 8, fontSize: 12 }}
                      >
                        View
                      </button>
                    </div>
                  )}
                  {editReceiptPreview && (
                    <div style={{ position: 'relative', display: 'inline-block', marginBottom: 8 }}>
                      <img
                        src={editReceiptPreview}
                        alt="New receipt"
                        style={{ maxWidth: '100%', maxHeight: 100, borderRadius: 6, border: '1px solid #ddd' }}
                      />
                      <button
                        onClick={() => { setEditReceipt(null); setEditReceiptPreview(null) }}
                        style={{
                          position: 'absolute', top: -8, right: -8,
                          width: 24, height: 24, borderRadius: '50%',
                          border: '2px solid white', background: '#ef4444',
                          color: 'white', cursor: 'pointer', fontSize: 14,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)', padding: 0
                        }}
                      >
                        ×
                      </button>
                    </div>
                  )}
                  <label style={{
                    display: 'inline-flex', alignItems: 'center', padding: '6px 12px',
                    border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer',
                    fontSize: 13, background: '#fafafa'
                  }}>
                    📷 {editForm.receipt_image_url || editReceiptPreview ? 'Replace' : 'Upload'} receipt
                    <input type="file" accept="image/*" onChange={handleEditReceiptChange} style={{ display: 'none' }} />
                  </label>
                </div>

                <div style={fieldStyle}>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={editForm.is_tax_deductible}
                      onChange={(e) => setEditForm({ ...editForm, is_tax_deductible: e.target.checked })}
                      style={{ marginRight: 8 }}
                    />
                    Tax deductible
                  </label>
                </div>

                {isProMode && (
                  <>
                    <div style={fieldStyle}>
                      <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={editForm.is_reimbursable}
                          onChange={(e) => setEditForm({ ...editForm, is_reimbursable: e.target.checked })}
                          style={{ marginRight: 8 }}
                        />
                        Reimbursable
                      </label>
                    </div>

                    {editForm.is_reimbursable && (
                      <div style={fieldStyle}>
                        <label style={labelStyle}>Employer / Client</label>
                        <input
                          type="text"
                          value={editForm.employer_or_client}
                          onChange={(e) => setEditForm({ ...editForm, employer_or_client: e.target.value })}
                          style={inputStyle}
                        />
                      </div>
                    )}

                    <div style={fieldStyle}>
                      <label style={labelStyle}>Tags (comma separated)</label>
                      <input
                        type="text"
                        value={editForm.tags}
                        onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                        style={inputStyle}
                      />
                    </div>
                  </>
                )}

                <div style={fieldStyle}>
                  <label style={labelStyle}>Notes</label>
                  <textarea
                    value={editForm.notes}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 15 }}>
                  <button
                    onClick={() => saveEdit(e.id)}
                    style={{ ...btnStyle, backgroundColor: '#4CAF50', color: 'white', fontWeight: 'bold' }}
                  >
                    ✓ Save Changes
                  </button>
                  <button
                    onClick={cancelEdit}
                    style={{ ...btnStyle, backgroundColor: '#f5f5f5' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {receiptModal && (
        <div
          onClick={() => setReceiptModal(null)}
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 2000,
            cursor: 'pointer'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '90%',
              maxHeight: '90%'
            }}
          >
            <img
              src={receiptModal}
              alt="Receipt"
              style={{
                maxWidth: '100%',
                maxHeight: '85vh',
                borderRadius: 12,
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
              }}
            />
            <button
              onClick={() => setReceiptModal(null)}
              style={{
                position: 'absolute',
                top: -12, right: -12,
                width: 36, height: 36,
                borderRadius: '50%',
                border: '2px solid white',
                background: '#ef4444',
                color: 'white',
                cursor: 'pointer',
                fontSize: 20,
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                padding: 0
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const pillStyle = {
  display: 'inline-block',
  padding: '4px 10px',
  border: '1px solid #ddd',
  borderRadius: 999,
  fontSize: 12,
  backgroundColor: '#f0f0f0'
}

const btnStyle = {
  padding: '6px 12px',
  fontSize: '13px',
  border: '1px solid #ddd',
  borderRadius: '4px',
  backgroundColor: 'white',
  cursor: 'pointer'
}

const fieldStyle = {
  marginBottom: 12
}

const labelStyle = {
  display: 'block',
  marginBottom: 5,
  fontWeight: 600,
  fontSize: 14
}

const inputStyle = {
  width: '100%',
  padding: 8,
  fontSize: 14,
  border: '1px solid #ddd',
  borderRadius: 4,
  boxSizing: 'border-box'
}