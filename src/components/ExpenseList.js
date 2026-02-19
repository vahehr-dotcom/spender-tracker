import { useState } from 'react'

export default function ExpenseList({
  expenses,
  categories,
  mainCategories = [],
  isProMode,
  onUpdate,
  onArchive,
  onDelete,
  onOpenReceipt
}) {
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})

  const categoryName = (id) => {
    const c = categories.find(x => x.id === id)
    return c ? c.name : '—'
  }

  const startEdit = (expense) => {
    setEditingId(expense.id)
    setEditForm({
      amount: Number(expense.amount).toFixed(2),
      merchant: expense.merchant,
      category_id: expense.category_id || '',
      payment_method: expense.payment_method,
      spent_at: new Date(expense.spent_at).toISOString().slice(0, 16),
      is_tax_deductible: expense.is_tax_deductible || false,
      is_reimbursable: expense.is_reimbursable || false,
      employer_or_client: expense.employer_or_client || '',
      notes: expense.notes || '',
      tags: (expense.tags || []).join(', ')
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditForm({})
  }

  const saveEdit = async (expenseId) => {
    const updated = {
      amount: parseFloat(editForm.amount),
      merchant: editForm.merchant,
      category_id: editForm.category_id || null,
      payment_method: editForm.payment_method,
      spent_at: new Date(editForm.spent_at).toISOString(),
      is_tax_deductible: editForm.is_tax_deductible,
      is_reimbursable: editForm.is_reimbursable,
      employer_or_client: editForm.employer_or_client || null,
      notes: editForm.notes || null,
      tags: editForm.tags ? editForm.tags.split(',').map(t => t.trim()).filter(Boolean) : null
    }

    await onUpdate(expenseId, updated)
    setEditingId(null)
    setEditForm({})
  }

  const handleDelete = (id, merchant) => {
    if (window.confirm(`Permanently delete $${expenses.find(e => e.id === id)?.amount} at ${merchant}? This cannot be undone.`)) {
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

  const hasGroupedCategories = mainCategories && mainCategories.length > 0

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
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button onClick={() => startEdit(e)} style={btnStyle}>✏️ Edit</button>

                    {e.receipt_image_url && (
                      <button onClick={() => onOpenReceipt(e.receipt_image_url)} style={btnStyle}>📎 Receipt</button>
                    )}

                    {!e.archived && (
                      <button onClick={() => onArchive(e.id)} style={btnStyle}>📦 Archive</button>
                    )}

                    <button
                      onClick={() => handleDelete(e.id, e.merchant)}
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
                  <label style={labelStyle}>Category</label>
                  <select
                    value={editForm.category_id}
                    onChange={(e) => setEditForm({ ...editForm, category_id: e.target.value })}
                    style={inputStyle}
                  >
                    <option value="">— Select category —</option>
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
                      categories.filter(c => c.parent_id === null).map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))
                    )}
                  </select>
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