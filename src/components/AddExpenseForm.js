import React from 'react'

function getNowLocalDateTime() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

export default function AddExpenseForm({
  // state
  amount, setAmount,
  merchant, setMerchant,
  spentAtLocal, setSpentAtLocal,
  paymentMethod, setPaymentMethod,
  categoryId, setCategoryId,
  categories,

  // basic/pro
  showMoreOptions, setShowMoreOptions,
  isTaxDeductible, setIsTaxDeductible,
  notes, setNotes,

  isProMode,
  isReimbursable, setIsReimbursable,
  employerOrClient, setEmployerOrClient,
  tagsText, setTagsText,

  // custom categories
  showAddCategory, setShowAddCategory,
  newCategoryName, setNewCategoryName,
  customCount,
  canAddCategory,
  onAddCustomCategory,
  onUpgradeToPro,

  // receipt
  receiptFile, setReceiptFile,

  // voice
  voiceSupported,
  isListening,
  transcript,
  startListening,
  stopListening,

  // actions
  onSave,
  isSaving,
  saveSuccess,

  // NEW: learned indicator
  categoryLearnedSource // "learned" | "rule" | null
}) {
  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <h2 style={{ marginBottom: '20px' }}>Add Expense</h2>

      {/* VOICE INPUT */}
      {voiceSupported && (
        <div style={{ 
          marginBottom: '20px', 
          padding: '15px', 
          border: '2px solid #4A90E2',
          borderRadius: '8px',
          backgroundColor: isListening ? '#E3F2FD' : '#F5F5F5'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <button
              onClick={isListening ? stopListening : startListening}
              style={{
                padding: '10px 20px',
                fontSize: '16px',
                fontWeight: 'bold',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                backgroundColor: isListening ? '#FF5252' : '#4CAF50',
                color: 'white',
                transition: 'background-color 0.3s'
              }}
            >
              {isListening ? '🔴 Stop' : '🎤 Start Voice Input'}
            </button>
            {isListening && (
              <span style={{ color: '#FF5252', fontWeight: 'bold', animation: 'pulse 1.5s infinite' }}>
                Listening...
              </span>
            )}
          </div>
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
            Say: <strong>"42 at Chevron"</strong> or <strong>"Spent 18 at Starbucks"</strong>
          </div>
          {transcript && (
            <div style={{ 
              marginTop: '10px', 
              padding: '10px', 
              backgroundColor: 'white',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px'
            }}>
              <strong>Transcript:</strong> {transcript}
            </div>
          )}
        </div>
      )}

      {/* AMOUNT */}
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
            borderRadius: '4px',
            boxSizing: 'border-box'
          }}
        />
      </div>

      {/* MERCHANT */}
      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
          Paid to <span style={{ color: 'red' }}>*</span>
        </label>
        <input
          type="text"
          value={merchant}
          onChange={(e) => setMerchant(e.target.value)}
          placeholder="e.g., Starbucks, Chevron, etc."
          style={{
            width: '100%',
            padding: '10px',
            fontSize: '16px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            boxSizing: 'border-box'
          }}
        />
      </div>

      {/* DATE & TIME */}
      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
          Date & Time <span style={{ color: 'red' }}>*</span>
        </label>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input
            type="datetime-local"
            value={spentAtLocal}
            onChange={(e) => setSpentAtLocal(e.target.value)}
            style={{
              flex: 1,
              padding: '10px',
              fontSize: '16px',
              border: '1px solid #ddd',
              borderRadius: '4px'
            }}
          />
          <button
            onClick={() => setSpentAtLocal(getNowLocalDateTime())}
            style={{
              padding: '10px 15px',
              fontSize: '14px',
              border: '1px solid #4A90E2',
              borderRadius: '4px',
              backgroundColor: 'white',
              color: '#4A90E2',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            Set to now
          </button>
        </div>
      </div>

      {/* CATEGORY with learned indicator */}
      <div style={{ marginBottom: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
          <label style={{ fontWeight: '600' }}>
            Category <span style={{ color: 'red' }}>*</span>
          </label>
          {categoryLearnedSource === 'learned' && (
            <span style={{ 
              fontSize: '12px', 
              padding: '2px 8px', 
              backgroundColor: '#4CAF50', 
              color: 'white', 
              borderRadius: '10px',
              fontWeight: 'bold'
            }}>
              Learned
            </span>
          )}
          {categoryLearnedSource === 'rule' && (
            <span style={{ 
              fontSize: '12px', 
              padding: '2px 8px', 
              backgroundColor: '#FF9800', 
              color: 'white', 
              borderRadius: '10px',
              fontWeight: 'bold'
            }}>
              Rule
            </span>
          )}
        </div>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          style={{
            width: '100%',
            padding: '10px',
            fontSize: '16px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            boxSizing: 'border-box'
          }}
        >
          <option value="">-- Select Category --</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>

        {/* Add custom category */}
        <div style={{ marginTop: '10px' }}>
          {canAddCategory ? (
            <button
              onClick={() => setShowAddCategory(true)}
              style={{
                padding: '8px 12px',
                fontSize: '14px',
                border: '1px solid #4A90E2',
                borderRadius: '4px',
                backgroundColor: 'white',
                color: '#4A90E2',
                cursor: 'pointer'
              }}
            >
              + Add Category
            </button>
          ) : (
            <div style={{ fontSize: '14px', color: '#666' }}>
              <span style={{ color: '#FF5252', fontWeight: 'bold' }}>Limit reached ({customCount})</span>
              {' '}
              <button
                onClick={onUpgradeToPro}
                style={{
                  marginLeft: '8px',
                  padding: '6px 10px',
                  fontSize: '13px',
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: '#FF9800',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Upgrade for unlimited
              </button>
            </div>
          )}
        </div>

        {/* Add category panel */}
        {showAddCategory && (
          <div style={{ 
            marginTop: '15px', 
            padding: '15px', 
            border: '1px solid #ddd',
            borderRadius: '6px',
            backgroundColor: '#F9F9F9'
          }}>
            <h4 style={{ marginTop: 0, marginBottom: '10px' }}>New Category</h4>
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="e.g., Groceries"
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '14px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                marginBottom: '10px',
                boxSizing: 'border-box'
              }}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={onAddCustomCategory}
                style={{
                  padding: '8px 15px',
                  fontSize: '14px',
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Save
              </button>
              <button
                onClick={() => setShowAddCategory(false)}
                style={{
                  padding: '8px 15px',
                  fontSize: '14px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  backgroundColor: 'white',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
            {!isProMode && (
              <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
                You can add up to 3 custom categories. Upgrade to Pro for unlimited.
              </div>
            )}
          </div>
        )}
      </div>

      {/* PAYMENT METHOD */}
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
            borderRadius: '4px',
            boxSizing: 'border-box'
          }}
        >
          <option value="">-- Select --</option>
          <option value="card">Card</option>
          <option value="cash">Cash</option>
          <option value="apple_pay">Apple Pay</option>
          <option value="other">Other</option>
        </select>
      </div>

      {/* MORE OPTIONS TOGGLE */}
      <div style={{ marginBottom: '15px' }}>
        <button
          onClick={() => setShowMoreOptions(!showMoreOptions)}
          style={{
            padding: '8px 12px',
            fontSize: '14px',
            border: '1px solid #4A90E2',
            borderRadius: '4px',
            backgroundColor: 'white',
            color: '#4A90E2',
            cursor: 'pointer'
          }}
        >
          {showMoreOptions ? '▼ Hide Options' : '▶ More Options'}
        </button>
      </div>

      {/* MORE OPTIONS (tax, notes) */}
      {showMoreOptions && (
        <div style={{ 
          marginBottom: '15px',
          padding: '15px',
          border: '1px solid #ddd',
          borderRadius: '6px',
          backgroundColor: '#FAFAFA'
        }}>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isTaxDeductible}
                onChange={(e) => setIsTaxDeductible(e.target.checked)}
                style={{ marginRight: '8px', cursor: 'pointer' }}
              />
              <span style={{ fontWeight: '600' }}>Tax deductible</span>
            </label>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '14px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                boxSizing: 'border-box',
                minHeight: '60px',
                resize: 'vertical'
              }}
            />
          </div>
        </div>
      )}

      {/* PRO OPTIONS */}
      {isProMode && (
        <div style={{ 
          marginBottom: '15px',
          padding: '15px',
          border: '2px solid #4CAF50',
          borderRadius: '6px',
          backgroundColor: '#E8F5E9'
        }}>
          <h4 style={{ marginTop: 0, marginBottom: '10px', color: '#2E7D32' }}>PRO Options</h4>
          
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isReimbursable}
                onChange={(e) => setIsReimbursable(e.target.checked)}
                style={{ marginRight: '8px', cursor: 'pointer' }}
              />
              <span style={{ fontWeight: '600' }}>Reimbursable</span>
            </label>
          </div>

          {isReimbursable && (
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                Employer / Client
              </label>
              <input
                type="text"
                value={employerOrClient}
                onChange={(e) => setEmployerOrClient(e.target.value)}
                placeholder="e.g., Acme Corp"
                style={{
                  width: '100%',
                  padding: '8px',
                  fontSize: '14px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          )}

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
              Tags
            </label>
            <input
              type="text"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="comma, separated, tags"
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '14px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                boxSizing: 'border-box'
              }}
            />
          </div>
        </div>
      )}

      {/* RECEIPT PHOTO */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
          Receipt Photo <span style={{ fontSize: '14px', color: '#666' }}>(optional)</span>
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
          style={{
            width: '100%',
            padding: '8px',
            fontSize: '14px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            boxSizing: 'border-box'
          }}
        />
        {receiptFile && (
          <div style={{ marginTop: '8px', fontSize: '14px', color: '#4CAF50' }}>
            <strong>Selected:</strong> {receiptFile.name}
          </div>
        )}
      </div>

      {/* SAVE BUTTON */}
      <button
        onClick={onSave}
        disabled={isSaving}
        style={{
          width: '100%',
          padding: '15px',
          fontSize: '18px',
          fontWeight: 'bold',
          border: 'none',
          borderRadius: '6px',
          cursor: isSaving ? 'not-allowed' : 'pointer',
          backgroundColor: isSaving ? '#B0BEC5' : saveSuccess ? '#4CAF50' : '#4A90E2',
          color: 'white',
          transition: 'background-color 0.3s'
        }}
      >
        {isSaving ? 'Saving...' : saveSuccess ? '✓ Saved' : 'Save'}
      </button>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}
