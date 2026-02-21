export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'POST') { return res.status(405).json({ error: 'Method not allowed' }) }

  const { merchant, description, message, categories } = req.body

  if (!merchant || !categories || categories.length === 0) {
    return res.status(400).json({ error: 'merchant and categories are required' })
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expense categorizer. Given a merchant name, optional description, and a list of available categories, return ONLY the category name that best fits. Return ONLY the exact category name from the list, nothing else. No quotes, no explanation, no punctuation.

Available categories:
${categories.join('\n')}

Rules:
- Pick the MOST specific matching category
- If the merchant is a known store (e.g. Costco, Target, Walmart), use the description to decide: "groceries at Costco" = Groceries, "tires at Costco" = Repairs & Maintenance
- If description mentions food/drink items, prefer food categories
- If nothing fits well, return "Miscellaneous"
- ONLY return a category name from the list above`
          },
          {
            role: 'user',
            content: `Merchant: ${merchant}${description ? `\nDescription: ${description}` : ''}${message ? `\nOriginal message: ${message}` : ''}`
          }
        ],
        max_tokens: 50,
        temperature: 0
      })
    })

    const data = await response.json()
    const category = (data.choices?.[0]?.message?.content || '').trim()

    if (category && categories.includes(category)) {
      return res.status(200).json({ success: true, category })
    }

    // Fuzzy match if AI returned close but not exact
    const lower = category.toLowerCase()
    const fuzzy = categories.find(c => c.toLowerCase() === lower)
    if (fuzzy) {
      return res.status(200).json({ success: true, category: fuzzy })
    }

    console.error('AI returned unknown category:', category)
    return res.status(200).json({ success: false, error: 'AI returned invalid category' })

  } catch (error) {
    console.error('Categorize expense error:', error)
    return res.status(200).json({ success: false, error: 'AI categorization failed' })
  }
}