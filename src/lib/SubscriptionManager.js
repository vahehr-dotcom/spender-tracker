import { supabase } from '../supabaseClient'

const TIER_LIMITS = {
  free: {
    daily_messages: 10,
    daily_tts: 3,
    daily_ai_parses: 5,
    custom_categories: 3,
    voice_commands: false,
    nova_memory: false,
    auto_categorization: false,
    tags: false,
    regrouping: false,
    receipt_scanning: false,
    reports: false,
    export: false,
    multi_year: false,
    tax_prep: false,
    full_nova: false,
  },
  pro: {
    daily_messages: 50,
    daily_tts: 25,
    daily_ai_parses: 30,
    custom_categories: Infinity,
    voice_commands: true,
    nova_memory: true,
    auto_categorization: true,
    tags: true,
    regrouping: true,
    receipt_scanning: true,
    reports: true,
    export: false,
    multi_year: false,
    tax_prep: false,
    full_nova: false,
  },
  max: {
    daily_messages: Infinity,
    daily_tts: Infinity,
    daily_ai_parses: Infinity,
    custom_categories: Infinity,
    voice_commands: true,
    nova_memory: true,
    auto_categorization: true,
    tags: true,
    regrouping: true,
    receipt_scanning: true,
    reports: true,
    export: true,
    multi_year: true,
    tax_prep: true,
    full_nova: true,
  },
  admin: {
    daily_messages: Infinity,
    daily_tts: Infinity,
    daily_ai_parses: Infinity,
    custom_categories: Infinity,
    voice_commands: true,
    nova_memory: true,
    auto_categorization: true,
    tags: true,
    regrouping: true,
    receipt_scanning: true,
    reports: true,
    export: true,
    multi_year: true,
    tax_prep: true,
    full_nova: true,
  },
  tester: {
    daily_messages: Infinity,
    daily_tts: Infinity,
    daily_ai_parses: Infinity,
    custom_categories: Infinity,
    voice_commands: true,
    nova_memory: true,
    auto_categorization: true,
    tags: true,
    regrouping: true,
    receipt_scanning: true,
    reports: true,
    export: true,
    multi_year: true,
    tax_prep: true,
    full_nova: true,
  },
}

class SubscriptionManager {
  constructor() {
    this.cache = null
    this.cacheExpiry = 0
    this.CACHE_TTL = 5 * 60 * 1000
  }

  async getSubscription(userId) {
    const now = Date.now()
    if (this.cache && this.cache.user_id === userId && now < this.cacheExpiry) {
      return this.cache
    }

    const { data, error } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error || !data) {
      console.error('SubscriptionManager: Failed to fetch subscription', error)
      return null
    }

    this.cache = data
    this.cacheExpiry = now + this.CACHE_TTL
    return data
  }

  async getEffectiveTier(userId) {
    const sub = await this.getSubscription(userId)
    if (!sub) return 'free'

    const tier = sub.tier
    const now = new Date()

    if (tier === 'admin' || tier === 'tester') return tier

    if (tier === 'guest') {
      if (sub.subscription_expires_at && new Date(sub.subscription_expires_at) < now) {
        await this._revertToFree(userId)
        return 'free'
      }
      return sub.guest_granted_tier || 'pro'
    }

    if (sub.subscription_status === 'trial') {
      if (sub.trial_end && new Date(sub.trial_end) < now) {
        await this._expireTrial(userId)
        return 'free'
      }
      return 'pro'
    }

    if (sub.subscription_status === 'active') {
      return tier
    }

    if (sub.subscription_status === 'expired' || sub.subscription_status === 'cancelled') {
      return 'free'
    }

    return 'free'
  }

  async getFeatures(userId) {
    const tier = await this.getEffectiveTier(userId)
    const limits = TIER_LIMITS[tier] || TIER_LIMITS.free

    return {
      tier,
      ...limits,
      isAdmin: tier === 'admin',
      isTester: tier === 'tester',
      isGuest: tier === 'guest',
      isPaid: tier === 'pro' || tier === 'max',
      isUnlimited: tier === 'admin' || tier === 'tester' || tier === 'max',
    }
  }

  async getTrialInfo(userId) {
    const sub = await this.getSubscription(userId)
    if (!sub) return { hasTrialed: false, isInTrial: false, daysLeft: 0 }

    const now = new Date()
    const isInTrial = sub.subscription_status === 'trial' && sub.trial_end && new Date(sub.trial_end) > now
    const daysLeft = isInTrial
      ? Math.ceil((new Date(sub.trial_end) - now) / (1000 * 60 * 60 * 24))
      : 0

    return {
      hasTrialed: sub.trial_used || false,
      isInTrial,
      daysLeft,
      trialEnd: sub.trial_end,
    }
  }

  async getDailyUsage(userId) {
    const today = new Date().toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('daily_usage')
      .select('*')
      .eq('user_id', userId)
      .eq('usage_date', today)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('SubscriptionManager: Failed to fetch daily usage', error)
    }

    return {
      message_count: data?.message_count || 0,
      tts_count: data?.tts_count || 0,
      ai_parse_count: data?.ai_parse_count || 0,
    }
  }

  async incrementUsage(userId, type) {
    const today = new Date().toISOString().split('T')[0]

    const { data: existing } = await supabase
      .from('daily_usage')
      .select('id, ' + type)
      .eq('user_id', userId)
      .eq('usage_date', today)
      .single()

    if (existing) {
      await supabase
        .from('daily_usage')
        .update({
          [type]: (existing[type] || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
    } else {
      await supabase
        .from('daily_usage')
        .insert({
          user_id: userId,
          usage_date: today,
          message_count: type === 'message_count' ? 1 : 0,
          tts_count: type === 'tts_count' ? 1 : 0,
          ai_parse_count: type === 'ai_parse_count' ? 1 : 0,
        })
    }
  }

  async canUse(userId, action) {
    const features = await this.getFeatures(userId)
    const usage = await this.getDailyUsage(userId)

    switch (action) {
      case 'message':
        return {
          allowed: features.daily_messages === Infinity || usage.message_count < features.daily_messages,
          remaining: features.daily_messages === Infinity ? Infinity : Math.max(0, features.daily_messages - usage.message_count),
          limit: features.daily_messages,
        }
      case 'tts':
        return {
          allowed: features.daily_tts === Infinity || usage.tts_count < features.daily_tts,
          remaining: features.daily_tts === Infinity ? Infinity : Math.max(0, features.daily_tts - usage.tts_count),
          limit: features.daily_tts,
        }
      case 'ai_parse':
        return {
          allowed: features.daily_ai_parses === Infinity || usage.ai_parse_count < features.daily_ai_parses,
          remaining: features.daily_ai_parses === Infinity ? Infinity : Math.max(0, features.daily_ai_parses - usage.ai_parse_count),
          limit: features.daily_ai_parses,
        }
      case 'voice':
        return { allowed: features.voice_commands }
      case 'memory':
        return { allowed: features.nova_memory }
      case 'auto_categorize':
        return { allowed: features.auto_categorization }
      case 'tags':
        return { allowed: features.tags }
      case 'regroup':
        return { allowed: features.regrouping }
      case 'receipt':
        return { allowed: features.receipt_scanning }
      case 'reports':
        return { allowed: features.reports }
      case 'export':
        return { allowed: features.export }
      case 'multi_year':
        return { allowed: features.multi_year }
      case 'tax_prep':
        return { allowed: features.tax_prep }
      case 'full_nova':
        return { allowed: features.full_nova }
      default:
        return { allowed: true }
    }
  }

  async adminUpgradeUser(targetUserId, newTier, expiresInDays = null) {
    const update = {
      tier: newTier === 'guest_pro' || newTier === 'guest_max' ? 'guest' : newTier,
      subscription_status: 'active',
      updated_at: new Date().toISOString(),
    }

    if (newTier === 'guest_pro') {
      update.guest_granted_tier = 'pro'
    } else if (newTier === 'guest_max') {
      update.guest_granted_tier = 'max'
    }

    if (expiresInDays && (newTier === 'guest_pro' || newTier === 'guest_max')) {
      const expires = new Date()
      expires.setDate(expires.getDate() + expiresInDays)
      update.subscription_expires_at = expires.toISOString()
    }

    const { error } = await supabase
      .from('user_subscriptions')
      .update(update)
      .eq('user_id', targetUserId)

    if (error) {
      console.error('SubscriptionManager: Admin upgrade failed', error)
      return false
    }

    this._clearCache()
    return true
  }

  async adminRevokeUser(targetUserId) {
    const { error } = await supabase
      .from('user_subscriptions')
      .update({
        tier: 'free',
        subscription_status: 'free',
        guest_granted_tier: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', targetUserId)

    if (error) {
      console.error('SubscriptionManager: Admin revoke failed', error)
      return false
    }

    this._clearCache()
    return true
  }

  async _expireTrial(userId) {
    await supabase
      .from('user_subscriptions')
      .update({
        tier: 'free',
        subscription_status: 'expired',
        trial_used: true,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)

    this._clearCache()
  }

  async _revertToFree(userId) {
    await supabase
      .from('user_subscriptions')
      .update({
        tier: 'free',
        subscription_status: 'free',
        guest_granted_tier: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)

    this._clearCache()
  }

  _clearCache() {
    this.cache = null
    this.cacheExpiry = 0
  }
}

const subscriptionManager = new SubscriptionManager()
export default subscriptionManager