export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'POST') { return res.status(405).json({ error: 'Method not allowed' }) }

  const { message } = req.body
  if (!message) return res.status(400).json({ error: 'No message provided' })

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an expense parser. Extract expense data from the user's message and return ONLY valid JSON with no markdown, no backticks, no explanation.

Return this exact structure:
{"amount": number, "merchant": "string", "description": "string or null", "dateHint": "today|yesterday|X days ago"}

Rules:
- amount: the dollar amount mentioned
- merchant: the store, business, or service provider name. If no specific merchant is named, create a short descriptive merchant like "Roof Repair", "Car Service", "Home Plumber". Never use generic words like "Car" or "House" alone.
- description: what was bought or what the expense was for. Null if not clear.
- dateHint: "today" unless they mention yesterday or X days ago
- Strip filler words like "I", "had to", "just", "my", etc.
- If the user says "at [place]" or "from [place]", that is the merchant.
- If the user mentions both a store AND an item, store = merchant, item = description.

Examples:
"i spent $32 at circle k on lotto tickets" → {"amount":32,"merchant":"Circle K","description":"lotto tickets","dateHint":"today"}
"add $6 coffee starbucks" → {"amount":6,"merchant":"Starbucks","description":"coffee","dateHint":"today"}
"i had to spend $2000 on my car, had to change the engine at ABC mechanic shop" → {"amount":2000,"merchant":"ABC Mechanic Shop","description":"engine change","dateHint":"today"}
"i just spent $2100 repairing my roof on my house" → {"amount":2100,"merchant":"Roof Repair","description":"roof repair on house","dateHint":"today"}
"bought a seiko watch at macy's for $200" → {"amount":200,"merchant":"Macy's","description":"Seiko watch","dateHint":"today"}
"paid $150 for groceries at costco yesterday" → {"amount":150,"merchant":"Costco","description":"groceries","dateHint":"yesterday"}`
          },
          { role: 'user', content: message }
        ],
        max_tokens: 150,
        temperature: 0
      })
    })

    const data = await response.json()
    const text = data.choices?.[0]?.message?.content || ''
    const cleaned = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(cleaned)

    res.status(200).json({ success: true, parsed })
  } catch (error) {
    console.error('Parse expense error:', error)
    res.status(200).json({ success: false, error: 'Failed to parse expense' })
  }
}