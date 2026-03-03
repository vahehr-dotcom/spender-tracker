import { supabase } from '../supabaseClient'
import ExpenseService from './ExpenseService'

// Keywords that are gender-sensitive — these exist in both Barbershop and Hair & Beauty
const GENDER_ROUTED_KEYWORDS = ['haircut', 'hair cut', 'trim', 'fantastic sams', 'supercuts', 'great clips']

class CategoryResolver {

  // ============================================
  // MAIN WATERFALL - the only method you call
  // ============================================
  static async resolve({ merchant, description, fullMessage, categories, userId, gender }) {
    const merchantKey = (merchant || '').toLowerCase().trim()
    if (!merchantKey || !categories || categories.length === 0) {
      return { id: null, name: null, resolvedBy: 'fallback', confidence: 0 }
    }

    // Step 1: User's personal overrides (always wins)
    const override = await CategoryResolver.checkUserOverride(userId, merchantKey)
    if (override) {
      const cat = categories.find(c => c.name.toLowerCase() === override.toLowerCase())
      if (cat) {
        console.log('🏷️ [1/5] User override:', merchantKey, '→', cat.name)
        return { id: cat.id, name: cat.name, resolvedBy: 'user_override', confidence: 1.0 }
      }
    }

    // Step 2: Global merchant cache
    const cached = await CategoryResolver.checkGlobalCache(merchantKey)
    if (cached && cached.confidence >= 0.6) {
      // If cached result is gender-sensitive, re-route based on gender
      const rerouted = CategoryResolver.applyGenderRoute(cached.category_name, gender, categories)
      if (rerouted) {
        console.log('🏷️ [2/5] Global cache (gender-routed):', merchantKey, '→', rerouted.name)
        return { id: rerouted.id, name: rerouted.name, resolvedBy: 'global_cache', confidence: cached.confidence }
      }
      const cat = categories.find(c => c.name.toLowerCase() === cached.category_name.toLowerCase())
      if (cat) {
        console.log('🏷️ [2/5] Global cache:', merchantKey, '→', cat.name, `(${cached.confidence})`)
        return { id: cat.id, name: cat.name, resolvedBy: 'global_cache', confidence: cached.confidence }
      }
    }

    // Step 3: Local keyword map (fast, free)
    const keywordMatch = ExpenseService.matchCategoryByKeyword(
      `${merchant} ${description || ''} ${fullMessage || ''}`
    )
    if (keywordMatch) {
      // Check if this is a gender-sensitive match and re-route
      const rerouted = CategoryResolver.applyGenderRoute(keywordMatch, gender, categories)
      if (rerouted) {
        console.log('🏷️ [3/5] Keyword map (gender-routed):', merchantKey, '→', rerouted.name)
        CategoryResolver.updateGlobalCache(merchantKey, rerouted.name, 0.7).catch(() => {})
        return { id: rerouted.id, name: rerouted.name, resolvedBy: 'keyword_map', confidence: 0.7 }
      }
      const cat = categories.find(c => c.name.toLowerCase() === keywordMatch.toLowerCase())
        || categories.find(c => c.name.toLowerCase().includes(keywordMatch.toLowerCase()))
      if (cat) {
        console.log('🏷️ [3/5] Keyword map:', merchantKey, '→', cat.name)
        CategoryResolver.updateGlobalCache(merchantKey, cat.name, 0.7).catch(() => {})
        return { id: cat.id, name: cat.name, resolvedBy: 'keyword_map', confidence: 0.7 }
      }
    }

    // Step 4: AI classification (slow, costs money)
    const aiResult = await CategoryResolver.askAI(merchant, description, fullMessage, categories)
    if (aiResult) {
      const rerouted = CategoryResolver.applyGenderRoute(aiResult, gender, categories)
      if (rerouted) {
        console.log('🏷️ [4/5] AI resolved (gender-routed):', merchantKey, '→', rerouted.name)
        CategoryResolver.updateGlobalCache(merchantKey, rerouted.name, 0.8).catch(() => {})
        return { id: rerouted.id, name: rerouted.name, resolvedBy: 'ai', confidence: 0.8 }
      }
      const cat = categories.find(c => c.name.toLowerCase() === aiResult.toLowerCase())
        || categories.find(c => c.name.toLowerCase().includes(aiResult.toLowerCase()))
      if (cat) {
        console.log('🏷️ [4/5] AI resolved:', merchantKey, '→', cat.name)
        CategoryResolver.updateGlobalCache(merchantKey, cat.name, 0.8).catch(() => {})
        return { id: cat.id, name: cat.name, resolvedBy: 'ai', confidence: 0.8 }
      }
    }

    // Step 5: Fallback to Miscellaneous
    const misc = categories.find(c => c.name === 'Miscellaneous')
      || categories[0]
    console.log('🏷️ [5/5] Fallback:', merchantKey, '→', misc.name)
    return { id: misc.id, name: misc.name, resolvedBy: 'fallback', confidence: 0.1 }
  }

  // ============================================
  // GENDER ROUTING - routes hair categories by gender
  // ============================================
  static applyGenderRoute(categoryName, gender, categories) {
    if (!gender) return null
    const lower = categoryName.toLowerCase()

    const hairCategories = ['hair & beauty', 'barbershop']
    if (!hairCategories.includes(lower)) return null

    let targetName
    if (gender === 'male') {
      targetName = 'Barbershop'
    } else if (gender === 'female') {
      targetName = 'Hair & Beauty'
    } else {
      return null
    }

    if (lower === targetName.toLowerCase()) return null

    const cat = categories.find(c => c.name === targetName)
    return cat || null
  }

  // ============================================
  // LAYER 1: User overrides
  // ============================================
  static async checkUserOverride(userId, merchantKey) {
    if (!userId) return null
    try {
      const { data, error } = await supabase
        .from('user_category_overrides')
        .select('category_name')
        .eq('user_id', userId)
        .eq('merchant_name', merchantKey)
        .maybeSingle()
      if (error || !data) return null
      return data.category_name
    } catch {
      return null
    }
  }

  // ============================================
  // LAYER 2: Global merchant cache
  // ============================================
  static async checkGlobalCache(merchantKey) {
    try {
      const { data, error } = await supabase
        .from('merchant_resolutions')
        .select('category_name, confidence')
        .eq('merchant_name', merchantKey)
        .maybeSingle()
      if (error || !data) return null
      return data
    } catch {
      return null
    }
  }

  static async updateGlobalCache(merchantKey, categoryName, confidence) {
    try {
      const { data: existing } = await supabase
        .from('merchant_resolutions')
        .select('id, resolution_count, confidence')
        .eq('merchant_name', merchantKey)
        .maybeSingle()

      if (existing) {
        const newCount = existing.resolution_count + 1
        const newConfidence = Math.min(
          0.99,
          ((existing.confidence * existing.resolution_count) + confidence) / newCount
        )
        await supabase
          .from('merchant_resolutions')
          .update({
            category_name: categoryName,
            confidence: newConfidence,
            resolution_count: newCount,
            last_resolved_at: new Date().toISOString()
          })
          .eq('id', existing.id)
      } else {
        await supabase
          .from('merchant_resolutions')
          .insert({
            merchant_name: merchantKey,
            category_name: categoryName,
            confidence,
            resolution_count: 1
          })
      }
    } catch (err) {
      console.warn('⚠️ Global cache update failed:', err)
    }
  }

  // ============================================
  // LAYER 4: AI classification
  // ============================================
  static async askAI(merchant, description, fullMessage, categories) {
    try {
      const categoryNames = categories.map(c => c.name)
      const response = await fetch('/api/categorize-expense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchant,
          description: description || null,
          message: fullMessage || null,
          categories: categoryNames
        })
      })
      const data = await response.json()
      if (data.success && data.category) {
        return data.category
      }
      return null
    } catch (err) {
      console.error('❌ AI categorization failed:', err)
      return null
    }
  }

  // ============================================
  // LEARNING: When user corrects a category
  // ============================================
  static async recordCorrection(userId, merchantName, categoryName) {
    const merchantKey = merchantName.toLowerCase().trim()

    try {
      await supabase
        .from('user_category_overrides')
        .upsert({
          user_id: userId,
          merchant_name: merchantKey,
          category_name: categoryName,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,merchant_name' })
      console.log('✅ User override saved:', merchantKey, '→', categoryName)
    } catch (err) {
      console.error('❌ Override save failed:', err)
    }

    await CategoryResolver.updateGlobalCache(merchantKey, categoryName, 0.9)
  }

  // ============================================
  // LOGGING: Track how each expense was resolved
  // ============================================
  static async log(userId, expenseId, merchantName, categoryName, resolvedBy, confidence) {
    try {
      await supabase
        .from('categorization_log')
        .insert({
          user_id: userId,
          expense_id: expenseId,
          merchant_name: merchantName.toLowerCase().trim(),
          category_name: categoryName,
          resolved_by: resolvedBy,
          ai_confidence: confidence
        })
    } catch (err) {
      console.warn('⚠️ Categorization log failed:', err)
    }
  }
}

export default CategoryResolver