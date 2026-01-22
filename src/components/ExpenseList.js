import { useState } from 'react'

export default function ExpenseList({
  expenses,
  categories,
  showArchived,
  receiptUrls,
  onArchive,
  onUnarchive,
  onDelete,
  onOpenReceipt,
  onUpdateExpense // NEW: callback to update expense
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
      category_id: expense.category_id,
      payment_method: expense.payment_method,
      spent_at: new Date(expense.spent_at).toISOString().slice(0, 16), // datetime-local format
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
      id: expenseId,
      amount: parseFloat(editForm.amount),
      merchant: editForm.merchant,
      category_id: editForm.category_id,
      payment_method: editForm.payment_method,
      spent_at: new Date(editForm.spent_at).toISOString(),
      is_tax_deductible: editForm.is_tax_deductible,
      is_reimbursable: editForm.is_reimbursable,
      employer_or_client: editForm.employer_or_client || null,
      notes: editForm.notes || null,
      tags: editForm.tags ? editForm.tags.split(',').map(t => t.trim()).filter(Boolean) : null
    }

    await onUpdateExpense(updated)
    setEditingId(null)
    setEditForm({})
  }

  if (!expenses || expenses.length === 0) {
    return <p>No expenses yet.</p>
  }

  return (
    <div style={{ marginTop: 15 }}>
      {expenses.map(e => {
        const thumb = receiptUrls[e.id]
        const isEditing = editingId === e.id

        return (
          <div
            key={e.id}
            style={{
              border: '1px solid #ddd',
              borderRadius: 10,
              padding: 12,
              marginBottom: 12,
              backgroundColor: isEditing ? '#FFF9E6' : 'white'
            }}
          >
            {!isEditing ? (
              // DISPLAY MODE
              <>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ fontSize: 18, fontWeight: 600 }}>
                    ${Number(e.amount).toFixed(2)} — {e.merchant}
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button onClick={() => startEdit(e)} style={btnStyle}>✏️ Edit</button>

                    {e.receipt_image_url ? (
                      <button onClick={() => onOpenReceipt(e)} style={btnStyle}>View receipt</button>
                    ) : null}

                    {!showArchived ? (
                      <button onClick={() => onArchive(e.id)} style={btnStyle}>Archive</button>
                    ) : (
                      <>
                        <button onClick={() => onUnarchive(e.id)} style={btnStyle}>Unarchive</button>
                        <button onClick={() => onDelete(e.id)} style={{ ...btnStyle, backgroundColor: '#FF5252', color: 'white' }}>Delete</button>
                      </>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: 6, opacity: 0.85 }}>
                  {categoryName(e.category_id)} • {e.payment_method} • {new Date(e.spent_at).toLocaleString()}
                </div>

                {e.location ? (
                  <div style={{ marginTop: 6, opacity: 0.85 }}>
                    📍 {e.location}
                  </div>
                ) : null}

                {(e.is_tax_deductible || e.is_reimbursable) ? (
                  <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {e.is_tax_deductible ? <span style={pillStyle}>Tax</span> : null}
                    {e.is_reimbursable ? (
                      <span style={pillStyle}>
                        Reimbursable{e.employer_or_client ? `: ${e.employer_or_client}` : ''}
                      </span>
                    ) : null}
                  </div>
                ) : null}

                {e.tags && e.tags.length ? (
                  <div style={{ marginTop: 8, opacity: 0.9 }}>
                    <strong>Tags:</strong> {e.tags.join(', ')}
                  </div>
                ) : null}

                {e.notes ? (
                  <div style={{ marginTop: 8, opacity: 0.9 }}>
                    <strong>Note:</strong> {e.notes}
                  </div>
                ) : null}

                {e.receipt_image_url ? (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>📎 Receipt attached</div>
                    {thumb ? (
                      <img
                        src={thumb}
                        alt="receipt thumbnail"
                        style={{ width: 160, borderRadius: 8, border: '1px solid #ddd' }}
                      />
                    ) : (
                      <div style={{ opacity: 0.7 }}>Loading thumbnail...</div>
                    )}
                  </div>
                ) : null}
              </>
            ) : (
              // EDIT MODE
              <div style={{ padding: 10 }}>
                <h4 style={{ marginTop: 0, marginBottom: 15 }}>✏️ Edit Expense</h4>

                {/* Amount */}
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

                {/* Merchant */}
                <div style={fieldStyle}>
                  <label style={labelStyle}>Paid to</label>
                  <input
                    type="text"
                    value={editForm.merchant}
                    onChange={(e) => setEditForm({ ...editForm, merchant: e.target.value })}
                    style={inputStyle}
                  />
                </div>

                {/* Category */}
                <div style={fieldStyle}>
                  <label style={labelStyle}>Category</label>
                  <select
                    value={editForm.category_id}
                    onChange={(e) => setEditForm({ ...editForm, category_id: e.target.value })}
                    style={inputStyle}
                  >
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                {/* Payment Method */}
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

                {/* Date & Time */}
                <div style={fieldStyle}>
                  <label style={labelStyle}>Date & Time</label>
                  <input
                    type="datetime-local"
                    value={editForm.spent_at}
                    onChange={(e) => setEditForm({ ...editForm, spent_at: e.target.value })}
                    style={inputStyle}
                  />
                </div>

                {/* Tax Deductible */}
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

                {/* Reimbursable */}
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

                {/* Tags */}
                <div style={fieldStyle}>
                  <label style={labelStyle}>Tags (comma separated)</label>
                  <input
                    type="text"
                    value={editForm.tags}
                    onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                    style={inputStyle}
                  />
                </div>

                {/* Notes */}
                <div style={fieldStyle}>
                  <label style={labelStyle}>Notes</label>
                  <textarea
                    value={editForm.notes}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
                  />
                </div>

                {/* Action buttons */}
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
  padding: '4px 8px',
  border: '1px solid #ddd',
  borderRadius: 999,
  fontSize: 12,
  opacity: 0.9
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
