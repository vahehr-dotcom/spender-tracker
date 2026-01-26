const handleAICommand = useCallback(
  async (cmd) => {
    if (cmd.action === 'add_expense') {
      const { merchant: m, amount: a, dateHint } = cmd.data
      if (m) setMerchant(m)
      if (a) setAmount(String(a))
      if (dateHint) {
        const parsed = parseNaturalDate(dateHint)
        if (parsed) {
          setSpentAtLocal(parsed.toISOString().slice(0, 16))
        }
      }
    } else if (cmd.action === 'update_expense') {
      const { query, updates } = cmd.data

      let targetExpense = null

      if (query === 'most_recent') {
        targetExpense = allExpenses[0]
      } else {
        const lowerQuery = query.toLowerCase()
        targetExpense = allExpenses.find(exp =>
          exp.merchant.toLowerCase().includes(lowerQuery)
        )

        if (!targetExpense) {
          const queryAmount = parseFloat(query)
          if (!isNaN(queryAmount)) {
            targetExpense = allExpenses.find(exp =>
              Math.abs(parseFloat(exp.amount) - queryAmount) < 0.01
            )
          }
        }
      }

      if (targetExpense) {
        await updateExpense(targetExpense.id, updates)
      } else {
        alert('Could not find that expense to update.')
      }
    } else if (cmd.action === 'search') {
      setSearch(cmd.data.query || '')
      setTimeout(() => loadExpenses(), 100)
    } else if (cmd.action === 'export') {
      exportCsv()
    }
  },
  [loadExpenses, allExpenses, updateExpense]
)
