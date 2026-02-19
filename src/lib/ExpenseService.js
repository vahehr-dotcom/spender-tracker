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
  'Movies & Events': ['movie', 'cinema', 'amc', 'regal', 'concert', 'ticketmaster', 'stubhub', 'live nation'],
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
  'Clothing & Shoes': ['clothing', 'clothes', 'shoes', 'nike', 'adidas', 'zara', 'h&m', 'ross', 'tjmaxx', 'marshalls', 'foot locker'],
  'Accessories': ['watch', 'jewelry', 'sunglasses', 'belt', 'handbag', 'purse', 'wallet', 'bracelet', 'necklace', 'earring', 'ring', 'cologne', 'perfume'],
  'Electronics': ['electronics', 'best buy', 'apple store', 'computer', 'laptop', 'phone case'],
  'Personal Care & Beauty': ['salon', 'haircut', 'barber', 'nails', 'spa', 'sephora', 'ulta', 'beauty'],
  'Home Goods': ['home goods', 'homegoods', 'bed bath', 'target home', 'home depot', 'lowes', 'ace hardware', 'roof', 'roofing', 'plumber', 'plumbing', 'hvac', 'contractor', 'handyman', 'home repair', 'house repair'],
  'General Retail': ['nordstrom', 'nordstrom rack', 'target', 'walmart', 'dollar tree', 'dollar general', 'five below', 'big lots', 'macy'],
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

const KNOWN_MERCHANTS = []

;(function buildMerchantList() {
  for (const keywords of Object.values(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (kw.length >= 3 && /[a-z]/.test(kw)) {
        KNOWN_MERCHANTS.push(kw)
      }
    }
  }
  KNOWN_MERCHANTS.sort((a, b) => b.length - a.length)
})()

class ExpenseService {

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

  static matchWordBoundary(text, keyword) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`\\b${escaped}\\b`, 'i')
    return regex.test(text)
  }

  static matchCategoryByKeyword(text) {
    const lower = text.toLowerCase()
    let bestMatch = null
    let bestLength = 0

    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      for (const keyword of keywords) {
        if (ExpenseService.matchWordBoundary(lower, keyword) && keyword.length > bestLength) {
          bestMatch = category
          bestLength = keyword.length
        }
      }
    }
    return bestMatch
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

  static resolveCategoryId(merchant, description, fullMessage, allCategories) {
    const descHint = description ? ExpenseService.matchCategoryByKeyword(description) : null
    const merchantHint = ExpenseService.matchCategoryByKeyword(merchant)
    const messageHint = ExpenseService.matchCategoryByKeyword(fullMessage)

    const hint = descHint || merchantHint || messageHint

    if (hint) {
      const id = ExpenseService.findCategoryId(hint, allCategories)
      if (id) {
        console.log('🏷️ Category matched:', hint, '→', id, descHint ? '(from description)' : merchantHint ? '(from merchant)' : '(from message)')
        return { id, name: hint }
      }
    }
    const misc = allCategories.find(c => c.name === 'Miscellaneous' && c.parent_id === null)
    const fallbackId = misc ? misc.id : (allCategories.length > 0 ? allCategories[0].id : null)
    console.log('🏷️ Category fallback: Miscellaneous →', fallbackId)
    return { id: fallbackId, name: 'Miscellaneous' }
  }

  static cleanMerchant(text) {
    return text
      .replace(/\b(i|a|an|the|some|from|at|to|for|in|on|my|and|or|just|it)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  static findKnownMerchant(text) {
    const lower = text.toLowerCase()
    for (const merchant of KNOWN_MERCHANTS) {
      if (ExpenseService.matchWordBoundary(lower, merchant)) {
        const escaped = merchant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const match = lower.match(new RegExp(`\\b${escaped}\\b`, 'i'))
        if (match) {
          const idx = match.index
          return {
            name: text.substring(idx, idx + merchant.length).trim(),
            keyword: merchant
          }
        }
      }
    }
    return null
  }

  static parseCommand(userMessage) {
    const lower = userMessage.toLowerCase()

    const isAdd = (lower.includes('add') || lower.includes('spent') || lower.includes('bought') || lower.includes('paid')) && /\$?\d+/.test(lower)
    if (!isAdd) return null

    const amountMatch = lower.match(/\$?(\d+(?:\.\d{2})?)/)
    if (!amountMatch) return null
    const amount = parseFloat(amountMatch[1])

    // Strip command words, amount, date hints, and pronouns
    let content = userMessage
      .replace(/\b(?:i|add|spent|bought|got|paid|just)\b/gi, '')
      .replace(/\$?\d+(?:\.\d{2})?/g, '')
      .replace(/\b(?:today|yesterday|\d+\s+days?\s+ago)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim()

    // Try "at/from [store]" pattern first
    const atMatch = userMessage.match(/\b(?:at|from)\s+([a-z0-9\s&'.-]+?)(?:\s+(?:today|yesterday|on|last|\$)|\s*$)/i)

    // Try to find a known merchant/store in the message
    const knownMerchant = ExpenseService.findKnownMerchant(userMessage)

    let merchant = null
    let description = null

    if (atMatch) {
      // Explicit "at/from Store" takes highest priority
      merchant = atMatch[1].trim()
      const merchantRegex = new RegExp('\\b(?:at|from)\\s+' + merchant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      const descParts = content.replace(merchantRegex, '').trim()
      const cleaned = ExpenseService.cleanMerchant(descParts)
      if (cleaned.length > 1) {
        description = cleaned
      }
    } else if (knownMerchant) {
      merchant = knownMerchant.name
      const descParts = content.replace(new RegExp(`\\b${knownMerchant.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), '').trim()
      const cleaned = ExpenseService.cleanMerchant(descParts)
      if (cleaned.length > 1) {
        description = cleaned
      }
    } else {
      // No known merchant, no "at" pattern — use cleaned content as description
      // and try to extract a sensible merchant from context
      const cleaned = ExpenseService.cleanMerchant(content)
      if (cleaned.length > 0) {
        // If it looks like a service description, use key noun as merchant
        const serviceWords = cleaned.match(/\b(repair|repairing|fixing|replacing|installing|painting|cleaning)\b/i)
        if (serviceWords) {
          // Extract the object being serviced as the merchant
          const afterService = cleaned.replace(serviceWords[0], '').trim()
          const objectWord = ExpenseService.cleanMerchant(afterService)
          if (objectWord.length > 1) {
            merchant = objectWord.replace(/\b\w/g, c => c.toUpperCase()) + ' ' + serviceWords[1].charAt(0).toUpperCase() + serviceWords[1].slice(1).toLowerCase()
          } else {
            merchant = serviceWords[1].charAt(0).toUpperCase() + serviceWords[1].slice(1).toLowerCase() + ' Service'
          }
          description = cleaned
        } else {
          merchant = cleaned
        }
      }
    }

    if (!merchant) return null

    // Capitalize merchant nicely
    merchant = merchant.replace(/\b\w/g, c => c.toUpperCase())

    let dateHint = 'today'
    if (lower.includes('yesterday')) dateHint = 'yesterday'
    else if (lower.match(/\d+\s+days?\s+ago/)) dateHint = lower.match(/\d+\s+days?\s+ago/)[0]

    return { amount, merchant, description, dateHint }
  }

  static resolveTimestamp(dateHint) {
    const now = new Date()
    if (dateHint === 'yesterday') {
      now.setDate(now.getDate() - 1)
    }
    return ExpenseService.getLocalISOString(now)
  }

  static async add({ userId, amount, merchant, categoryId, spentAt, paymentMethod = 'card', note = null, description = null, receiptUrl = null }) {
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
      description,
      receipt_image_url: receiptUrl || null,
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

  static async addFromChat({ userId, userMessage, categories }) {
    const parsed = ExpenseService.parseCommand(userMessage)
    if (!parsed) return { success: false, error: 'Could not parse expense from message' }

    const { id: categoryId, name: categoryName } = ExpenseService.resolveCategoryId(
      parsed.merchant, parsed.description, userMessage, categories
    )

    if (!categoryId) return { success: false, error: 'No categories available' }

    const spentAt = ExpenseService.resolveTimestamp(parsed.dateHint)

    const result = await ExpenseService.add({
      userId,
      amount: parsed.amount,
      merchant: parsed.merchant,
      categoryId,
      spentAt,
      description: parsed.description
    })

    return {
      ...result,
      parsed: { ...parsed, categoryName }
    }
  }

  static async addFromForm({ userId, amount, merchant, categoryId, spentAt, paymentMethod, note, description, receiptUrl }) {
    return await ExpenseService.add({
      userId,
      amount,
      merchant,
      categoryId,
      spentAt: spentAt || ExpenseService.getLocalISOString(),
      paymentMethod,
      note,
      description,
      receiptUrl
    })
  }
}

export default ExpenseService