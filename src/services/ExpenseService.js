import { supabase } from '../supabaseClient'

const CATEGORY_KEYWORDS = {
  'Coffee & Tea': ['starbucks', 'coffee', 'cafe', 'latte', 'espresso', 'tea', 'boba', 'dutch bros', 'peets', 'dunkin'],
  'Groceries': ['grocery', 'groceries', 'costco', 'trader joe', 'whole foods', 'safeway', 'kroger', 'albertsons', 'ralphs', 'vons', 'aldi', 'sprouts', 'food4less'],
  'Dining Out': ['restaurant', 'dining', 'dinner', 'lunch', 'brunch', 'dine', 'ihop', 'applebee', 'chili', 'olive garden', 'cheesecake factory', 'chipotle', 'panera', 'subway', 'panda express'],
  'Bars & Drinks': ['bar', 'pub', 'brewery', 'wine', 'beer', 'cocktail', 'nightclub', 'lounge'],
  'Snacks & Convenience': ['snack', 'convenience', '7-eleven', '7eleven', 'circle k', 'ampm', 'wawa', 'sheetz'],
  'Gas & Fuel': ['gas', 'fuel', 'shell', 'chevron', 'exxon', 'mobil', 'bp', 'arco', 'costco gas', 'gasoline', 'texaco', '76'],
  'EV Charging': ['ev charging', 'supercharger', 'supercharging', 'tesla charging', 'chargepoint', 'electrify america', 'evgo', 'blink'],
  'Car Payment': ['car payment', 'auto payment', 'vehicle payment', 'car note'],
  'Car Insurance': ['car insurance', 'auto insurance', 'geico', 'progressive', 'state farm auto', 'allstate auto'],
  'Repairs & Maintenance': ['oil change', 'tire', 'brake', 'mechanic', 'auto repair', 'car wash', 'car repair', 'smog', 'alignment'],
  'Registration': ['registration', 'dmv', 'vehicle registration'],
  'Parking & Tolls': ['parking', 'toll', 'meter', 'fastrak', 'parkwhiz'],
  'Rent': ['rent', 'apartment rent'],
  'Mortgage': ['mortgage', 'home loan'],
  'Home Insurance': ['home insurance', 'homeowner insurance', 'renters insurance'],
  'Furniture & Decor': ['furniture', 'ikea', 'wayfair', 'crate and barrel', 'pottery barn', 'decor'],
  'Cleaning & Supplies': ['cleaning', 'supplies', 'paper towel', 'detergent', 'lysol'],
  'Electric': ['electric', 'electricity', 'edison', 'power bill', 'sce', 'pg&e'],
  'Water': ['water bill', 'water utility', 'water department'],
  'Internet': ['internet', 'wifi', 'spectrum', 'att internet', 'xfinity', 'comcast', 'frontier'],
  'Phone': ['phone bill', 'tmobile', 't-mobile', 'verizon', 'att phone', 'mint mobile', 'cricket'],
  'Trash & Sewer': ['trash', 'sewer', 'waste management', 'garbage'],
  'Doctor & Co-pay': ['doctor', 'copay', 'co-pay', 'physician', 'clinic', 'urgent care', 'kaiser'],
  'Pharmacy': ['pharmacy', 'cvs', 'walgreens', 'rite aid', 'prescription', 'medication', 'medicine'],
  'Dental': ['dentist', 'dental', 'orthodontist', 'teeth'],
  'Vision': ['eye doctor', 'optometrist', 'glasses', 'contacts', 'lenscrafters', 'vision'],
  'Mental Health': ['therapist', 'therapy', 'counseling', 'psychiatrist', 'mental health'],
  'Fitness & Gym': ['gym', 'fitness', 'planet fitness', 'la fitness', 'equinox', 'crossfit', 'yoga', 'peloton', '24 hour fitness'],
  'Amazon': ['amazon'],
  'eBay': ['ebay'],
  'General Online Retail': ['online order', 'shein', 'temu', 'wish', 'etsy', 'shopify'],
  'Digital Purchases': ['itunes', 'google play', 'digital', 'download', 'ebook'],
  'App Purchases': ['app store', 'in-app', 'app purchase'],
  'Streaming': ['netflix', 'hulu', 'disney+', 'disney plus', 'hbo', 'max', 'paramount', 'peacock', 'apple tv', 'youtube premium', 'spotify', 'pandora', 'tidal'],
  'Movies & Events': ['movie', 'cinema', 'amc', 'regal', 'concert', 'event', 'tickets', 'ticketmaster', 'stubhub', 'live nation'],
  'Games': ['game', 'playstation', 'xbox', 'nintendo', 'steam', 'gaming'],
  'Books & Music': ['book', 'kindle', 'audible', 'barnes noble', 'music'],
  'Apps & Software': ['software', 'subscription', 'adobe', 'microsoft', 'dropbox', 'icloud', 'google one', 'chatgpt', 'openai'],
  'Memberships': ['membership', 'costco membership', 'sam club', 'amazon prime', 'prime membership'],
  'Meal Kits': ['hello fresh', 'blue apron', 'home chef', 'meal kit', 'factor'],
  'Fixed Bills': ['bill', 'payment due'],
  'Debt Payments': ['debt', 'loan payment'],
  'Credit Cards': ['credit card payment', 'visa payment', 'mastercard payment', 'amex payment', 'chase payment', 'capital one payment'],
  'Student Loans': ['student loan', 'student debt', 'navient', 'sallie mae', 'nelnet', 'mohela'],
  'Personal Loans': ['personal loan', 'sofi loan', 'lending club', 'prosper loan'],
  'Medical Debt': ['medical bill', 'hospital bill', 'medical debt', 'medical payment'],
  'Clothing & Shoes': ['clothing', 'clothes', 'shoes', 'nike', 'adidas', 'zara', 'h&m', 'nordstrom', 'ross', 'tjmaxx', 'marshalls', 'foot locker'],
  'Electronics': ['electronics', 'best buy', 'apple store', 'computer', 'laptop', 'phone case'],
  'Personal Care & Beauty': ['salon', 'haircut', 'barber', 'nails', 'spa', 'sephora', 'ulta', 'beauty'],
  'Home Goods': ['home goods', 'homegoods', 'bed bath', 'target home', 'home depot', 'lowes', 'ace hardware'],
  'General Retail': ['target', 'walmart', 'dollar tree', 'dollar general', 'five below', 'big lots'],
  'Childcare': ['daycare', 'childcare', 'babysitter', 'nanny'],
  'School & Tuition': ['tuition', 'school', 'university', 'college', 'education'],
  'Activities': ['soccer', 'baseball', 'dance class', 'piano', 'karate', 'swim class', 'camp', 'kids activity'],
  'Kids Clothing': ['kids clothes', 'children clothing', 'carter', 'oshkosh', 'gap kids', 'old navy kids'],
  'Pet Food': ['pet food', 'dog food', 'cat food', 'chewy'],
  'Vet': ['vet', 'veterinarian', 'animal hospital', 'pet doctor'],
  'Grooming': ['pet grooming', 'dog grooming', 'cat grooming'],
  'Pet Supplies': ['pet supplies', 'petco', 'petsmart', 'pet store'],
  'Pet Insurance': ['pet insurance', 'trupanion', 'embrace pet'],
  'Flights': ['flight', 'airline', 'airfare', 'united', 'delta', 'southwest', 'american airlines', 'jetblue', 'spirit airlines'],
  'Hotels & Lodging': ['hotel', 'motel', 'airbnb', 'vrbo', 'lodging', 'resort', 'marriott', 'hilton', 'hyatt'],
  'Night Life': ['nightlife', 'night out', 'club', 'lounge', 'happy hour'],
  'Weekend Trips': ['weekend trip', 'road trip', 'getaway', 'day trip'],
  'Vacation Activities': ['excursion', 'tour', 'sightseeing', 'attraction', 'theme park', 'disneyland', 'disney world', 'universal studios'],
  'Miscellaneous': ['lotto', 'lottery', 'gift card', 'donation', 'charity', 'tip', 'birthday gift', 'holiday gift']
}

class ExpenseService {

  // ─── TIMESTAMP ────────────────────────────────────────────
  static getLocalISOString(date = new Date()) {
    const offset = -date.getTimezoneOffset()
    const sign = offset >= 0 ? '+' : '-'
    const hours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0')
    const minutes = String(Math.abs(offset) % 60).padStart(2, '0')
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const min = String(date.getMinutes()).padStart(2, '0')
    const sec = String(date.getSeconds()).padStart(2, '0')
    return `${year}-${month}-${day}T${hour}:${min}:${sec}${sign}${hours}:${minutes}`
  }

  // ─── CATEGORY MATCHING ────────────────────────────────────
  static matchCategoryByKeyword(text) {
    const lower = text.toLowerCase()
    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      for (const keyword of keywords) {
        if (lower.includes(keyword)) {
          return category
        }
      }
    }
    return null
  }

  static findCategoryId(categoryName, allCategories) {
    if (!categoryName || !allCategories || allCategories.length === 0) return null
    const exact = allCategories.find(c => c.name === categoryName)
    if (exact) return exact.id
    const lower = categoryName.toLowerCase()
    const fuzzy = allCategories.find(c =>
      c.name.toLowerCase().includes(lower) || lower.includes(c.name.toLowerCase())
    )
    if (fuzzy) return fuzzy.id
    return null
  }

  static resolveCategoryId(merchant, fullMessage, allCategories) {
    const hint = ExpenseService.matchCategoryByKeyword(merchant) || ExpenseService.matchCategoryByKeyword(fullMessage)
    if (hint) {
      const id = ExpenseService.findCategoryId(hint, allCategories)
      if (id) {
        console.log('🏷️ Category matched:', hint, '→', id)
        return { id, name: hint }
      }
    }
    const misc = allCategories.find(c => c.name === 'Miscellaneous' && c.parent_id === null)
    const fallbackId = misc ? misc.id : (allCategories.length > 0 ? allCategories[0].id : null)
    console.log('🏷️ Category fallback: Miscellaneous →', fallbackId)
    return { id: fallbackId, name: 'Miscellaneous' }
  }

  // ─── PARSE NATURAL LANGUAGE ───────────────────────────────
  static parseCommand(userMessage) {
    const lower = userMessage.toLowerCase()

    const isAdd = (lower.includes('add') || lower.includes('spent')) && /\$?\d+/.test(lower)
    if (!isAdd) return null

    const amountMatch = lower.match(/\$?(\d+(?:\.\d{2})?)/)
    if (!amountMatch) return null
    const amount = parseFloat(amountMatch[1])

    let merchant = null

    const atMatch = userMessage.match(/\b(?:at|to|for|in)\s+([a-z0-9\s&'-]+?)(?:\s+(?:today|yesterday|on|last)|\s*$)/i)
    if (atMatch) {
      merchant = atMatch[1].trim()
    }

    if (!merchant) {
      const afterAmount = userMessage.replace(/(?:add|spent)\s+\$?\d+(?:\.\d{2})?/i, '').trim()
      const words = afterAmount.split(/\s+/).filter(w => {
        const cleaned = w.toLowerCase()
        return cleaned.length > 0 && !(/^(at|to|for|in|today|yesterday|on)$/.test(cleaned))
      })
      if (words.length > 0) {
        merchant = words.join(' ')
      }
    }

    if (!merchant) {
      const betweenMatch = userMessage.match(/\$?\d+(?:\.\d{2})?\s+(.+?)(?:\s+(?:today|yesterday|[\w\s]+ago)|$)/i)
      if (betweenMatch) {
        merchant = betweenMatch[1].replace(/\b(?:at|to|for|in)\b/gi, '').trim()
      }
    }

    if (!merchant) return null

    let dateHint = 'today'
    if (lower.includes('yesterday')) dateHint = 'yesterday'
    else if (lower.match(/\d+\s+days?\s+ago/)) dateHint = lower.match(/\d+\s+days?\s+ago/)[0]

    return { amount, merchant, dateHint }
  }

  // ─── BUILD TIMESTAMP FROM DATE HINT ───────────────────────
  static resolveTimestamp(dateHint) {
    const now = new Date()
    if (dateHint === 'yesterday') {
      now.setDate(now.getDate() - 1)
    }
    return ExpenseService.getLocalISOString(now)
  }

  // ─── SINGLE ADD METHOD — THE ONLY WAY TO ADD AN EXPENSE ──
  static async add({ userId, amount, merchant, categoryId, spentAt, paymentMethod = 'card', note = null }) {
    if (!userId || !amount || !merchant || !categoryId) {
      return { success: false, error: 'Missing required fields: userId, amount, merchant, categoryId' }
    }

    const expense = {
      user_id: userId,
      amount: parseFloat(amount),
      merchant,
      category_id: categoryId,
      spent_at: spentAt || ExpenseService.getLocalISOString(),
      payment_method: paymentMethod,
      note,
      archived: false
    }

    console.log('💰 ExpenseService.add:', expense)

    try {
      const { data, error } = await supabase
        .from('expenses')
        .insert([expense])
        .select()

      if (error) {
        console.error('❌ ExpenseService insert error:', error)
        return { success: false, error: error.message }
      }

      console.log('✅ ExpenseService insert success:', data)
      return { success: true, data: data[0] }
    } catch (err) {
      console.error('❌ ExpenseService exception:', err)
      return { success: false, error: err.message }
    }
  }

  // ─── CONVENIENCE: ADD FROM NATURAL LANGUAGE ───────────────
  static async addFromChat({ userId, userMessage, categories }) {
    const parsed = ExpenseService.parseCommand(userMessage)
    if (!parsed) return { success: false, error: 'Could not parse expense from message' }

    const { id: categoryId, name: categoryName } = ExpenseService.resolveCategoryId(
      parsed.merchant, userMessage, categories
    )

    if (!categoryId) return { success: false, error: 'No categories available' }

    const spentAt = ExpenseService.resolveTimestamp(parsed.dateHint)

    const result = await ExpenseService.add({
      userId,
      amount: parsed.amount,
      merchant: parsed.merchant,
      categoryId,
      spentAt
    })

    return {
      ...result,
      parsed: { ...parsed, categoryName }
    }
  }

  // ─── CONVENIENCE: ADD FROM MANUAL FORM ────────────────────
  static async addFromForm({ userId, amount, merchant, categoryId, spentAt, paymentMethod, note }) {
    return await ExpenseService.add({
      userId,
      amount,
      merchant,
      categoryId,
      spentAt: spentAt || ExpenseService.getLocalISOString(),
      paymentMethod,
      note
    })
  }
}

export default ExpenseService