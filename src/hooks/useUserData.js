import { useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'

// Emails that get PRO access automatically
const PRO_EMAILS = [
  'lifeliftusa@gmail.com',
  'vahehr@gmail.com',
  'awillie2006@gmail.com',
  'sako3000@gmail.com'
]

// Emails that get admin access (CEO only)
const ADMIN_EMAILS = [
  'lifeliftusa@gmail.com'
]

export function useUserData() {
  const [userRole, setUserRole] = useState('user')
  const [userProfile, setUserProfile] = useState(null)
  const [subscriptionStatus, setSubscriptionStatus] = useState('basic')
  const [categories, setCategories] = useState([])
  const [profileLoading, setProfileLoading] = useState(true)

  // Load user role from preferences
  const loadUserRole = useCallback(async (userId) => {
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('preference_value')
        .eq('user_id', userId)
        .eq('preference_type', 'role')
        .single()

      if (error) {
        console.error('Load role error:', error)
        setUserRole('user')
        return 'user'
      }

      const role = data?.preference_value || 'user'
      setUserRole(role)
      return role
    } catch (err) {
      console.error('Role load error:', err)
      setUserRole('user')
      return 'user'
    }
  }, [])

  // Load user profile from user_profiles table (new) with fallback to user_preferences (old)
  const loadUserProfile = useCallback(async (userId, email) => {
    setProfileLoading(true)
    try {
      // First try the new user_profiles table
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (profileData && !profileError) {
        console.log('Loaded user profile from user_profiles:', profileData)
        setUserProfile(profileData)
        setProfileLoading(false)
        return profileData
      }

      // Fallback to old user_preferences table
      const { data, error } = await supabase
        .from('user_preferences')
        .select('preference_type, preference_value')
        .eq('user_id', userId)
        .in('preference_type', ['display_name', 'title'])

      if (error) {
        console.error('Load profile error:', error)
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

      console.log('Loaded user profile from user_preferences:', profile)
      setUserProfile(profile)
      setProfileLoading(false)
      return profile
    } catch (err) {
      console.error('Profile load error:', err)
      setProfileLoading(false)
      return null
    }
  }, [])

  // Check if user has completed onboarding
  const checkOnboardingStatus = useCallback(async (userId) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('onboarding_completed, first_name')
        .eq('id', userId)
        .single()

      if (error || !data) {
        // No profile exists - needs onboarding
        return { needsOnboarding: true, profile: null }
      }

      // Profile exists but no first name - needs onboarding
      if (!data.first_name) {
        return { needsOnboarding: true, profile: data }
      }

      // Profile complete
      return { needsOnboarding: false, profile: data }
    } catch (err) {
      console.error('Onboarding check error:', err)
      return { needsOnboarding: true, profile: null }
    }
  }, [])

  // Create or update user profile
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
      console.error('Save profile error:', err)
      return { success: false, error: err.message }
    }
  }, [])

  // Load subscription status
  const loadSubscription = useCallback(async (email) => {
    // Check if email gets automatic PRO
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

  // Load categories
  const loadCategories = useCallback(async (userId) => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', userId)
        .order('name')

      if (error) throw error
      setCategories(data || [])
      return data || []
    } catch (err) {
      console.error('Load categories error:', err)
      return []
    }
  }, [])

  // Add custom category
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
      console.error('Add category error:', err)
      return { success: false, error: err.message }
    }
  }, [])

  // Check if user is admin
  const isAdmin = useCallback((email) => {
    return ADMIN_EMAILS.includes(email) || userRole === 'admin'
  }, [userRole])

  // Load all user data at once
  const loadAllUserData = useCallback(async (userId, email) => {
    const results = await Promise.all([
      loadUserRole(userId),
      loadUserProfile(userId, email),
      loadSubscription(email),
      loadCategories(userId)
    ])

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
    setCategories
  }
}