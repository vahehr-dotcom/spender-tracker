import { useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'

export function useUserData() {
  const [userRole, setUserRole] = useState('user')
  const [userProfile, setUserProfile] = useState(null)
  const [subscriptionStatus, setSubscriptionStatus] = useState('basic')
  const [categories, setCategories] = useState([])
  const [mainCategories, setMainCategories] = useState([])
  const [profileLoading, setProfileLoading] = useState(true)

  const loadUserRole = useCallback(async (userId) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', userId)
        .single()

      if (error || !data) {
        setUserRole('user')
        return 'user'
      }

      const role = data.role || 'user'
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

  const loadSubscription = useCallback(async (userId) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('is_pro')
        .eq('id', userId)
        .single()

      if (error || !data) {
        setSubscriptionStatus('basic')
        return 'basic'
      }

      const status = data.is_pro ? 'pro' : 'basic'
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
        .order('sort_order')

      console.log('📂 Categories query result:', { data, error })

      if (error) {
        console.error('📂 Categories error:', error)
        setCategories([])
        setMainCategories([])
        return []
      }

      const filtered = data.filter(c => c.user_id === null || c.user_id === userId)
      
      const mains = filtered.filter(c => c.parent_id === null)
      const subs = filtered.filter(c => c.parent_id !== null)

      const grouped = mains.map(main => ({
        ...main,
        subcategories: subs.filter(s => s.parent_id === main.id).sort((a, b) => a.sort_order - b.sort_order)
      }))

      console.log('📂 Main categories:', mains.length, 'Subcategories:', subs.length)

      setMainCategories(grouped)
      setCategories(filtered)
      return filtered
    } catch (err) {
      console.error('📂 Load categories exception:', err)
      setCategories([])
      setMainCategories([])
      return []
    }
  }, [])

  const addCategory = useCallback(async (userId, name, parentId = null) => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .insert({
          user_id: userId,
          name: name.trim(),
          is_custom: true,
          parent_id: parentId
        })
        .select()
        .single()

      if (error) throw error

      setCategories(prev => [...prev, data])
      
      if (parentId) {
        setMainCategories(prev => prev.map(main => 
          main.id === parentId 
            ? { ...main, subcategories: [...main.subcategories, data] }
            : main
        ))
      } else {
        setMainCategories(prev => [...prev, { ...data, subcategories: [] }])
      }

      return { success: true, category: data }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }, [])

  const isAdmin = useCallback(() => {
    return userRole === 'admin' || userProfile?.role === 'admin'
  }, [userRole, userProfile])

  const isTester = useCallback(() => {
    return userRole === 'tester' || userRole === 'admin' || userProfile?.role === 'tester' || userProfile?.role === 'admin'
  }, [userRole, userProfile])

  const loadAllUserData = useCallback(async (userId, email) => {
    console.log('🔄 loadAllUserData called:', userId, email)
    
    const [role, profile, subscription, cats] = await Promise.all([
      loadUserRole(userId),
      loadUserProfile(userId, email),
      loadSubscription(userId),
      loadCategories(userId)
    ])

    console.log('🔄 loadAllUserData results:', { role, profile, subscription, categories: cats?.length })

    return {
      role,
      profile,
      subscription,
      categories: cats
    }
  }, [loadUserRole, loadUserProfile, loadSubscription, loadCategories])

  return {
    userRole,
    userProfile,
    subscriptionStatus,
    categories,
    mainCategories,
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