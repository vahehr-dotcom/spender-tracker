import { useState } from 'react';

export default function ImportPreview({ 
  transactions, 
  categories, 
  onImport, 
  onCancel 
}) {
  const [selected, setSelected] = useState(
    transactions.map(() => true) // All selected by default
  );
  const [editingIndex, setEditingIndex] = useState(null);
  const [editForm, setEditForm] = useState({});

  const toggleSelect = (index) => {
    const newSelected = [...selected];
    newSelected[index] = !newSelected[index];
    setSelected(newSelected);
  };

  const toggleSelectAll = () => {
    const allSelected = selected.every(s => s);
    setSelected(transactions.map(() => !allSelected));
  };

  const startEdit = (index) => {
    setEditingIndex(index);
    setEditForm({ ...transactions[index] });
  };

  const saveEdit = (index) => {
    transactions[index] = { ...editForm };
    setEditingIndex(null);
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditForm({});
  };

  const handleImport = () => {
    const selectedTransactions = transactions.filter((_, i) => selected[i]);
    onImport(selectedTransactions);
  };

  const selectedCount = selected.filter(s => s).length;

  return (
    <div style={{
      background: 'white',
      border: '1px solid #ddd',
      borderRadius: '12px',
      padding: '20px',
      marginBottom: '20px'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <div>
          <h2 style={{ margin: 0, marginBottom: '5px' }}>
            📋 Review Transactions
          </h2>
          <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
            {selectedCount} of {transactions.length} selected
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              background: '#f5f5f5',
              border: '1px solid #ddd',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={selectedCount === 0}
            style={{
              padding: '8px 24px',
              background: selectedCount > 0 ? '#10b981' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: selectedCount > 0 ? 'pointer' : 'not-allowed',
              fontWeight: 'bold'
            }}
          >
            Import {selectedCount} Expense{selectedCount !== 1 ? 's' : ''}
          </button>
        </div>
      </div>

      {/* Select All */}
      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={selected.every(s => s)}
            onChange={toggleSelectAll}
            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
          />
          <span style={{ fontWeight: 'bold', fontSize: '14px' }}>Select All</span>
        </label>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '14px'
        }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ padding: '12px 8px', textAlign: 'left', width: '40px' }}>
                <input
                  type="checkbox"
                  checked={selected.every(s => s)}
                  onChange={toggleSelectAll}
                  style={{ cursor: 'pointer' }}
                />
              </th>
              <th style={{ padding: '12px 8px', textAlign: 'left' }}>Date</th>
              <th style={{ padding: '12px 8px', textAlign: 'left' }}>Merchant</th>
              <th style={{ padding: '12px 8px', textAlign: 'right' }}>Amount</th>
              <th style={{ padding: '12px 8px', textAlign: 'left' }}>Category</th>
              <th style={{ padding: '12px 8px', textAlign: 'left' }}>Notes</th>
              <th style={{ padding: '12px 8px', textAlign: 'center', width: '100px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((txn, index) => (
              <tr
                key={index}
                style={{
                  borderBottom: '1px solid #e5e7eb',
                  background: selected[index] ? 'white' : '#f9fafb',
                  opacity: selected[index] ? 1 : 0.5
                }}
              >
                {editingIndex === index ? (
                  // Edit mode
                  <>
                    <td style={{ padding: '8px' }}>
                      <input
                        type="checkbox"
                        checked={selected[index]}
                        onChange={() => toggleSelect(index)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ padding: '8px' }}>
                      <input
                        type="date"
                        value={editForm.date?.split('T')[0] || ''}
                        onChange={(e) => setEditForm({ ...editForm, date: new Date(e.target.value).toISOString() })}
                        style={{ width: '100%', padding: '4px', border: '1px solid #ddd', borderRadius: '4px' }}
                      />
                    </td>
                    <td style={{ padding: '8px' }}>
                      <input
                        type="text"
                        value={editForm.merchant || ''}
                        onChange={(e) => setEditForm({ ...editForm, merchant: e.target.value })}
                        style={{ width: '100%', padding: '4px', border: '1px solid #ddd', borderRadius: '4px' }}
                      />
                    </td>
                    <td style={{ padding: '8px' }}>
                      <input
                        type="number"
                        step="0.01"
                        value={editForm.amount || ''}
                        onChange={(e) => setEditForm({ ...editForm, amount: parseFloat(e.target.value) })}
                        style={{ width: '100%', padding: '4px', border: '1px solid #ddd', borderRadius: '4px', textAlign: 'right' }}
                      />
                    </td>
                    <td style={{ padding: '8px' }}>
                      <select
                        value={editForm.category || ''}
                        onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                        style={{ width: '100%', padding: '4px', border: '1px solid #ddd', borderRadius: '4px' }}
                      >
                        <option value="">Uncategorized</option>
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.id}>
                            {cat.icon} {cat.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '8px' }}>
                      <input
                        type="text"
                        value={editForm.notes || ''}
                        onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                        style={{ width: '100%', padding: '4px', border: '1px solid #ddd', borderRadius: '4px' }}
                      />
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <button
                        onClick={() => saveEdit(index)}
                        style={{
                          padding: '4px 8px',
                          background: '#10b981',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          marginRight: '4px'
                        }}
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        style={{
                          padding: '4px 8px',
                          background: '#f5f5f5',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        Cancel
                      </button>
                    </td>
                  </>
                ) : (
                  // View mode
                  <>
                    <td style={{ padding: '8px' }}>
                      <input
                        type="checkbox"
                        checked={selected[index]}
                        onChange={() => toggleSelect(index)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ padding: '8px' }}>
                      {new Date(txn.date).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '8px', fontWeight: '500' }}>
                      {txn.merchant}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>
                      ${txn.amount.toFixed(2)}
                    </td>
                    <td style={{ padding: '8px' }}>
                      {txn.category ? (
                        categories.find(c => c.id === txn.category)?.name || txn.category
                      ) : (
                        <span style={{ color: '#999' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '8px', fontSize: '12px', color: '#666' }}>
                      {txn.notes || <span style={{ color: '#ccc' }}>—</span>}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <button
                        onClick={() => startEdit(index)}
                        style={{
                          padding: '4px 8px',
                          background: '#f5f5f5',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        Edit
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
