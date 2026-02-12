import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'

export function useAuth() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loginStatus, setLoginStatus] = useState('')

  const sessionIdRef = useRef(null)
  const intervalRef = useRef(null)
  const sessionStartRef = useRef(null)
  const hasLoggedRef = useRef(false)

  useEffect(() => {
    const initSession = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession()
        setSession(currentSession)
        setLoading(false)
      } catch (error) {
        console.error('Session init error:', error)
        setLoading(false)
      }
    }

    initSession()

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setLoading(false)
    })

    const handleBeforeUnload = () => {
      if (sessionIdRef.current && sessionStartRef.current) {
        const duration = Math.floor((Date.now() - sessionStartRef.current) / 1000)
        const url = `${process.env.REACT_APP_SUPABASE_URL}/rest/v1/user_sessions?id=eq.${sessionIdRef.current}`
        const body = JSON.stringify({
          session_end: new Date().toISOString(),
          duration_seconds: duration
        })
        navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      if (authListener && authListener.subscription) {
        authListener.subscription.unsubscribe()
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [])

  const handleLogin = async (email, password) => {
    try {
      setLoginStatus('Logging in...')
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        setLoginStatus(`Error: ${error.message}`)
        return { success: false, error: error.message }
      }

      setSession(data.session)
      setLoginStatus('Login successful!')
      return { success: true }
    } catch (err) {
      console.error('Login error:', err)
      setLoginStatus('Login failed. Please try again.')
      return { success: false, error: err.message }
    }
  }

  const handleLogout = async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (sessionIdRef.current && sessionStartRef.current) {
      const duration = Math.floor((Date.now() - sessionStartRef.current) / 1000)
      try {
        await supabase
          .from('user_sessions')
          .update({
            session_end: new Date().toISOString(),
            duration_seconds: duration
          })
          .eq('id', sessionIdRef.current)
      } catch (err) {
        console.error('Session end error:', err)
      }
    }

    hasLoggedRef.current = false
    sessionIdRef.current = null
    sessionStartRef.current = null
    
    await supabase.auth.signOut()
    setSession(null)
  }

  const startSession = async (userId, email) => {
    if (sessionIdRef.current) return

    try {
      const { data: existingSession } = await supabase
        .from('user_sessions')
        .select('id')
        .eq('user_id', userId)
        .is('session_end', null)
        .single()

      if (existingSession) {
        sessionIdRef.current = existingSession.id
        sessionStartRef.current = Date.now()
      } else {
        const { data: newSession, error } = await supabase
          .from('user_sessions')
          .insert({
            user_id: userId,
            email: email,
            session_start: new Date().toISOString(),
            last_activity: new Date().toISOString(),
            device_info: { userAgent: navigator.userAgent }
          })
          .select()
          .single()

        if (error) {
          console.error('Session start error:', error)
          return
        }

        sessionIdRef.current = newSession.id
        sessionStartRef.current = Date.now()
      }

      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }

      intervalRef.current = setInterval(() => {
        updateSessionActivity()
      }, 30000)

    } catch (err) {
      console.error('Start session error:', err)
    }
  }

  const updateSessionActivity = async () => {
    if (!sessionIdRef.current) return

    try {
      await supabase
        .from('user_sessions')
        .update({ last_activity: new Date().toISOString() })
        .eq('id', sessionIdRef.current)
    } catch (err) {
      console.error('Update activity error:', err)
    }
  }

  const logLogin = async (email) => {
    if (hasLoggedRef.current) return
    hasLoggedRef.current = true

    try {
      await supabase.from('login_logs').insert({
        email: email,
        logged_in_at: new Date().toISOString(),
        device_info: { userAgent: navigator.userAgent }
      })
      console.log('Login tracked for', email)
    } catch (err) {
      console.error('Login log error:', err)
    }
  }

  const logPageView = async (userId, pageName = 'dashboard') => {
    try {
      await supabase.from('page_views').insert({
        user_id: userId,
        page_name: pageName,
        page_url: window.location.pathname,
        viewed_at: new Date().toISOString(),
        device_info: { userAgent: navigator.userAgent }
      })
    } catch (err) {
      console.error('Page view log error:', err)
    }
  }

  return {
    session,
    loading,
    loginStatus,
    handleLogin,
    handleLogout,
    startSession,
    logLogin,
    logPageView
  }
}