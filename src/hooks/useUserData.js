import { useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'

const PRO_EMAILS = [
  'lifeliftusa@gmail.com',
  'vahehr@gmail.com',
  'awillie2006@gmail.com',
  'sako3000@gmail.com'
]

const ADMIN_EMAILS = [
  'lifeliftusa@gmail.com'
]

const TESTER_EMAILS = [
  'lifeliftusa@gmail.com',
  'vahehr@gmail.com',
  'awillie2006@gmail.com',
  'sako3000@gmail.com'
]

export function useUserData() {
  const [userRole, setUserRole] = useState('user')
  const [userProfile, setUserProfile] = useState(null)
  const [subscriptionStatus, setSubscriptionStatus] = useState('basic')
  const [categories, setCategories] = useState([])
  const [profileLoading, setProfileLoading] = useState(true)

  const loadUserRole = useCallback(async (userId) => {
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('preference_value')
        .eq('user_id', userId)
        .eq('preference_type', 'role')
        .single()

      if (error) {
        setUserRole('user')
        return 'user'
      }

      const role = data?.preference_value || 'user'
      setUserRole(role)
      return role
    } catch (err) {
      setUserRole('user')
      return 'user'
    }
  }, [])

  const loadUserProfile = useCallback(async (userId, email) => {
    setProfileLoading(true)
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (profileData && !profileError) {
        setUserProfile(profileData)
        setProfileLoading(false)
        return profileData
      }

      const { data, error } = await supabase
        .from('user_preferences')
        .select('preference_type, preference_value')
        .eq('user_id', userId)
        .in('preference_type', ['display_name', 'title'])

      if (error) {
        setProfileLoading(false)
        return null
      }

      const profile = { id: userId, email }
      data.forEach(pref => {
        if (pref.preference_type === 'display_name') {
          profile.first_name = pref.preference_value
        }
        profile[pref.preference_type] = pref.preference_value
      })

      setUserProfile(profile)
      setProfileLoading(false)
      return profile
    } catch (err) {
      setProfileLoading(false)
      return null
    }
  }, [])

  const checkOnboardingStatus = useCallback(async (userId) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('onboarding_completed, first_name')
        .eq('id', userId)
        .single()

      if (error || !data) {
        return { needsOnboarding: true, profile: null }
      }

      if (!data.first_name) {
        return { needsOnboarding: true, profile: data }
      }

      return { needsOnboarding: false, profile: data }
    } catch (err) {
      return { needsOnboarding: true, profile: null }
    }
  }, [])

  const saveUserProfile = useCallback(async (userId, profileData) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .upsert({
          id: userId,
          ...profileData,
          onboarding_completed: true,
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) throw error

      setUserProfile(data)
      return { success: true, profile: data }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }, [])

  const loadSubscription = useCallback(async (email) => {
    if (PRO_EMAILS.includes(email)) {
      setSubscriptionStatus('pro')
      return 'pro'
    }

    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('email', email)
        .single()

      if (error) {
        setSubscriptionStatus('basic')
        return 'basic'
      }

      const status = data?.status || 'basic'
      setSubscriptionStatus(status)
      return status
    } catch (err) {
      setSubscriptionStatus('basic')
      return 'basic'
    }
  }, [])

  const loadCategories = useCallback(async (userId) => {
    console.log('📂 loadCategories called with userId:', userId)
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name')

      console.log('📂 Categories query result:', { data, error })

      if (error) {
        console.error('📂 Categories error:', error)
        setCategories([])
        return []
      }

      const filtered = data.filter(c => c.user_id === null || c.user_id === userId)
      console.log('📂 Filtered categories:', filtered.length)
      
      setCategories(filtered)
      return filtered
    } catch (err) {
      console.error('📂 Load categories exception:', err)
      setCategories([])
      return []
    }
  }, [])

  const addCategory = useCallback(async (userId, name) => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .insert({
          user_id: userId,
          name: name.trim(),
          is_custom: true
        })
        .select()
        .single()

      if (error) throw error

      setCategories(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      return { success: true, category: data }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }, [])

  const isAdmin = useCallback((email) => {
    return ADMIN_EMAILS.includes(email) || userRole === 'admin'
  }, [userRole])

  const isTester = useCallback((email) => {
    return TESTER_EMAILS.includes(email)
  }, [])

  const loadAllUserData = useCallback(async (userId, email) => {
    console.log('🔄 loadAllUserData called:', userId, email)
    const results = await Promise.all([
      loadUserRole(userId),
      loadUserProfile(userId, email),
      loadSubscription(email),
      loadCategories(userId)
    ])

    console.log('🔄 loadAllUserData results:', results)

    return {
      role: results[0],
      profile: results[1],
      subscription: results[2],
      categories: results[3]
    }
  }, [loadUserRole, loadUserProfile, loadSubscription, loadCategories])

  return {
    userRole,
    userProfile,
    subscriptionStatus,
    categories,
    profileLoading,
    loadUserRole,
    loadUserProfile,
    loadSubscription,
    loadCategories,
    loadAllUserData,
    checkOnboardingStatus,
    saveUserProfile,
    addCategory,
    isAdmin,
    isTester,
    setCategories
  }
}