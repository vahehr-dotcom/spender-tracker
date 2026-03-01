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
- "add": User is stating they spent money OR commanding to add an expense. Keywords like "add", "log", "track", "record", "spent", "paid", "bought", "got", "picked up" plus an amount AND a specific merchant or store name. Example: "add $50 at Target", "spent $12 at Subway on lunch", "paid $80 at Costco for groceries", "bought $30 worth of gas at Shell"
- "suggest": User mentions spending money conversationally WITHOUT a specific named merchant/store. They describe what happened but the merchant is vague or unnamed. Example: "i ended up spending $2500 on my AC repair", "my car cost me $800 to fix", "dinner set me back $120", "just dropped $300 on clothes"
- "none": No expense information at all. Example: "how am i doing this month?", "what did i spend on food?", "hello", "thanks nova"

Parsing rules (for "add" and "suggest" intents):
- amount: the dollar amount mentioned
- merchant: the store, business, or service provider name. If no specific merchant is named, create a short descriptive merchant like "AC Repair", "Car Service", "Lunch", "Dinner". Never use generic words like "Car" or "House" alone.
- description: additional detail ONLY if the user explicitly stated it. NEVER invent, guess, or assume details the user did not say. If the user only mentions the amount and a general activity like "lunch" or "dinner", set description to null. If the merchant already captures what the expense is for, set description to null.
- dateHint: "today" unless they mention yesterday or X days ago

CRITICAL: Never hallucinate or fabricate information. Only extract what the user actually said.

Examples:
"add $6 coffee starbucks" → {"intent":"add","amount":6,"merchant":"Starbucks","description":"coffee","dateHint":"today"}
"spent $32 at circle k on lotto tickets" → {"intent":"add","amount":32,"merchant":"Circle K","description":"lotto tickets","dateHint":"today"}
"spent $12 at subway on lunch" → {"intent":"add","amount":12,"merchant":"Subway","description":"lunch","dateHint":"today"}
"paid $5 to craigslist for a car ad" → {"intent":"add","amount":5,"merchant":"Craigslist","description":"car ad","dateHint":"today"}
"bought groceries and a new jacket at costco for $180" → {"intent":"add","amount":180,"merchant":"Costco","description":"groceries and jacket","dateHint":"today"}
"i ended up spending $2500 on my home AC unit repair" → {"intent":"suggest","amount":2500,"merchant":"AC Repair","description":null,"dateHint":"today"}
"i went out to lunch and spent $45" → {"intent":"suggest","amount":45,"merchant":"Lunch","description":null,"dateHint":"today"}
"spent $2900 on a san diego trip" → {"intent":"suggest","amount":2900,"merchant":"San Diego Trip","description":null,"dateHint":"today"}
"just dropped $300 at nordstrom" → {"intent":"add","amount":300,"merchant":"Nordstrom","description":null,"dateHint":"today"}
"my car cost me $800 to fix" → {"intent":"suggest","amount":800,"merchant":"Car Repair","description":null,"dateHint":"today"}
"dinner set me back $120" → {"intent":"suggest","amount":120,"merchant":"Dinner","description":null,"dateHint":"today"}
"how am i doing this month?" → {"intent":"none","amount":null,"merchant":null,"description":null,"dateHint":"today"}`
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