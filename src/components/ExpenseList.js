export default function ExpenseList({
  expenses,
  categories,
  showArchived,
  receiptUrls,
  onArchive,
  onUnarchive,
  onDelete,
  onOpenReceipt
}) {
  const categoryName = (id) => {
    const c = categories.find(x => x.id === id)
    return c ? c.name : '—'
  }

  if (!expenses || expenses.length === 0) {
    return <p>No expenses yet.</p>
  }

  return (
    <div style={{ marginTop: 15 }}>
      {expenses.map(e => {
        const thumb = receiptUrls[e.id]

        return (
          <div
            key={e.id}
            style={{
              border: '1px solid #ddd',
              borderRadius: 10,
              padding: 12,
              marginBottom: 12
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ fontSize: 18, fontWeight: 600 }}>
                ${Number(e.amount).toFixed(2)} — {e.merchant}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                {e.receipt_image_url ? (
                  <button onClick={() => onOpenReceipt(e)}>View receipt</button>
                ) : null}

                {!showArchived ? (
                  <button onClick={() => onArchive(e.id)}>Archive</button>
                ) : (
                  <>
                    <button onClick={() => onUnarchive(e.id)}>Unarchive</button>
                    <button onClick={() => onDelete(e.id)}>Delete</button>
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
