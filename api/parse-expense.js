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
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You analyze user messages for expense tracking. Determine if the message contains expense information and return ONLY valid JSON with no markdown, no backticks, no explanation.

Return this exact structure:
{"intent": "add|suggest|none", "amount": number or null, "merchant": "string or null", "description": "string or null", "dateHint": "today|yesterday|X days ago"}

Intent rules:
- "add": User is clearly commanding to add an expense. Keywords like "add", "log", "track", "record" plus an amount. Example: "add $50 at Target", "log $200 groceries at Costco"
- "suggest": User is talking conversationally but mentions spending money. They didn't ask to add it, but there's a clear amount and what it was for. Example: "i ended up spending $2500 on my AC repair", "my car cost me $800 to fix", "just dropped $300 at Nordstrom", "dinner set me back $120"
- "none": No expense information at all. Example: "how am i doing this month?", "what did i spend on food?", "hello", "thanks nova"

Parsing rules (for "add" and "suggest" intents):
- amount: the dollar amount mentioned
- merchant: the store, business, or service provider name. If no specific merchant is named, create a short descriptive merchant like "AC Repair", "Car Service", "Home Plumber". Never use generic words like "Car" or "House" alone.
- description: what was bought or what the expense was for. Null if not clear.
- dateHint: "today" unless they mention yesterday or X days ago

Examples:
"add $6 coffee starbucks" → {"intent":"add","amount":6,"merchant":"Starbucks","description":"coffee","dateHint":"today"}
"spent $32 at circle k on lotto tickets" → {"intent":"add","amount":32,"merchant":"Circle K","description":"lotto tickets","dateHint":"today"}
"i ended up spending $2500 on my home AC unit repair" → {"intent":"suggest","amount":2500,"merchant":"AC Repair","description":"home AC unit repair","dateHint":"today"}
"my car set me back $800 at the mechanic" → {"intent":"suggest","amount":800,"merchant":"Mechanic","description":"car repair","dateHint":"today"}
"just dropped $300 at nordstrom" → {"intent":"suggest","amount":300,"merchant":"Nordstrom","description":null,"dateHint":"today"}
"how am i doing this month?" → {"intent":"none","amount":null,"merchant":null,"description":null,"dateHint":"today"}
"what's my biggest expense?" → {"intent":"none","amount":null,"merchant":null,"description":null,"dateHint":"today"}`
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