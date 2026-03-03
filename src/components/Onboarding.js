import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function Onboarding({ user, onComplete, onLogout }) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [gender, setGender] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [prefilledFrom, setPrefilledFrom] = useState(null)
  const [pendingData, setPendingData] = useState(null)

  useEffect(() => {
    if (user) {
      const metadata = user.user_metadata || {}
      
      let detectedFirstName = ''
      let detectedLastName = ''
      let detectedAvatar = ''
      let source = null

      if (metadata.full_name || metadata.name) {
        const fullName = metadata.full_name || metadata.name
        const parts = fullName.split(' ')
        detectedFirstName = parts[0] || ''
        detectedLastName = parts.slice(1).join(' ') || ''
        source = 'Google'
      }

      if (metadata.given_name) {
        detectedFirstName = metadata.given_name
        source = 'Google'
      }
      if (metadata.family_name) {
        detectedLastName = metadata.family_name
      }

      if (metadata.avatar_url || metadata.picture) {
        detectedAvatar = metadata.avatar_url || metadata.picture
      }

      if (metadata.first_name) {
        detectedFirstName = metadata.first_name
        source = 'Apple'
      }
      if (metadata.last_name) {
        detectedLastName = metadata.last_name
      }

      if (metadata.first_name && !source) {
        detectedFirstName = metadata.first_name
        source = 'Facebook'
      }

      if (detectedFirstName) {
        setFirstName(detectedFirstName)
        setPrefilledFrom(source)
      }
      if (detectedLastName) {
        setLastName(detectedLastName)
      }
      if (detectedAvatar) {
        setAvatarUrl(detectedAvatar)
      }

      checkPendingUser(user.email)

      console.log('👤 OAuth data:', { metadata, detectedFirstName, detectedLastName, source })
    }
  }, [user])

  const checkPendingUser = async (email) => {
    try {
      const { data, error } = await supabase
        .from('pending_users')
        .select('*')
        .eq('email', email.toLowerCase())
        .single()

      if (data && !error) {
        setPendingData(data)
        console.log('🎉 Found pending user data:', data)
      }
    } catch (err) {
      // Not in pending list, that's fine
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!firstName.trim()) {
      setError('Please enter your first name')
      return
    }

    if (!lastName.trim()) {
      setError('Please enter your last name')
      return
    }

    if (!gender) {
      setError('Please select your gender')
      return
    }

    setIsSaving(true)
    setError('')

    try {
      const profileData = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        gender,
        email: user.email,
        avatar_url: avatarUrl || null
      }

      if (pendingData) {
        profileData.role = pendingData.role || 'user'
        profileData.is_pro = pendingData.is_pro || false
        console.log('🎉 Applying pending user settings:', { role: profileData.role, is_pro: profileData.is_pro })

        await supabase
          .from('pending_users')
          .delete()
          .eq('id', pendingData.id)
      }

      await onComplete(profileData)
    } catch (err) {
      setError('Failed to save. Please try again.')
      setIsSaving(false)
    }
  }

  const genderOptions = [
    { value: 'male', label: '👨', sublabel: 'Male' },
    { value: 'female', label: '👩', sublabel: 'Female' },
    { value: 'other', label: '🧑', sublabel: 'Other' }
  ]

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '24px',
        padding: '50px',
        maxWidth: '500px',
        width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        textAlign: 'center'
      }}>
        <div style={{
          width: '80px',
          height: '80px',
          background: avatarUrl ? 'transparent' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '50%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          margin: '0 auto 30px',
          fontSize: '40px',
          overflow: 'hidden',
          border: avatarUrl ? '3px solid #667eea' : 'none'
        }}>
          {avatarUrl ? (
            <img 
              src={avatarUrl} 
              alt="Profile" 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            '👋'
          )}
        </div>

        <h1 style={{
          margin: '0 0 10px',
          fontSize: '32px',
          fontWeight: 700,
          color: '#1f2937'
        }}>
          {firstName ? `Hey ${firstName}!` : 'Welcome to Spender Tracker!'}
        </h1>

        <p style={{
          margin: '0 0 20px',
          fontSize: '18px',
          color: '#6b7280'
        }}>
          {prefilledFrom 
            ? `We got your info from ${prefilledFrom}. Confirm or update below.`
            : "Let's personalize your experience. What should Nova call you?"}
        </p>

        {pendingData && (
          <div style={{
            padding: '12px 20px',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            borderRadius: '12px',
            marginBottom: '20px',
            color: 'white',
            fontSize: '14px'
          }}>
            🎉 You've been pre-registered! 
            {pendingData.is_pro && ' PRO access included.'}
            {pendingData.role === 'tester' && ' Tester access enabled.'}
            {pendingData.role === 'admin' && ' Admin access enabled.'}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px', textAlign: 'left' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#374151'
            }}>
              First Name <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Enter your first name"
              autoFocus={!firstName}
              style={{
                width: '100%',
                padding: '14px 16px',
                fontSize: '16px',
                border: '2px solid #e5e7eb',
                borderRadius: '12px',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s',
                outline: 'none',
                background: prefilledFrom ? '#f0fdf4' : 'white'
              }}
              onFocus={(e) => e.target.style.borderColor = '#667eea'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            />
            {prefilledFrom && firstName && (
              <p style={{ fontSize: '12px', color: '#10b981', marginTop: '6px' }}>
                ✓ Pre-filled from {prefilledFrom}
              </p>
            )}
          </div>

          <div style={{ marginBottom: '20px', textAlign: 'left' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#374151'
            }}>
              Last Name <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Enter your last name"
              style={{
                width: '100%',
                padding: '14px 16px',
                fontSize: '16px',
                border: '2px solid #e5e7eb',
                borderRadius: '12px',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s',
                outline: 'none',
                background: prefilledFrom && lastName ? '#f0fdf4' : 'white'
              }}
              onFocus={(e) => e.target.style.borderColor = '#667eea'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            />
          </div>

          <div style={{ marginBottom: '30px', textAlign: 'left' }}>
            <label style={{
              display: 'block',
              marginBottom: '12px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#374151'
            }}>
              I am <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              {genderOptions.map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setGender(option.value)}
                  style={{
                    flex: 1,
                    padding: '16px 12px',
                    borderRadius: '16px',
                    border: gender === option.value ? '3px solid #667eea' : '2px solid #e5e7eb',
                    background: gender === option.value ? 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)' : 'white',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: gender === option.value ? '0 4px 12px rgba(102, 126, 234, 0.25)' : 'none'
                  }}
                >
                  <span style={{ fontSize: '32px' }}>{option.label}</span>
                  <span style={{
                    fontSize: '13px',
                    fontWeight: gender === option.value ? 700 : 500,
                    color: gender === option.value ? '#667eea' : '#6b7280'
                  }}>
                    {option.sublabel}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p style={{
              color: '#ef4444',
              fontSize: '14px',
              marginBottom: '20px',
              padding: '12px',
              background: '#fef2f2',
              borderRadius: '8px'
            }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSaving}
            style={{
              width: '100%',
              padding: '16px 24px',
              fontSize: '18px',
              fontWeight: 600,
              border: 'none',
              borderRadius: '12px',
              background: isSaving 
                ? '#9ca3af' 
                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s',
              boxShadow: '0 4px 14px rgba(102, 126, 234, 0.4)'
            }}
            onMouseOver={(e) => !isSaving && (e.target.style.transform = 'translateY(-2px)')}
            onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
          >
            {isSaving ? 'Saving...' : prefilledFrom ? 'Looks Good! →' : 'Get Started →'}
          </button>
        </form>

        <p style={{
          marginTop: '30px',
          fontSize: '13px',
          color: '#9ca3af'
        }}>
          Nova is your AI assistant who will help you track expenses and manage your finances.
        </p>

        <button
          onClick={onLogout}
          style={{
            marginTop: '20px',
            background: 'none',
            border: 'none',
            color: '#6b7280',
            cursor: 'pointer',
            fontSize: '14px',
            textDecoration: 'underline'
          }}
        >
          ← Back to Login (use different account)
        </button>
      </div>
    </div>
  )
}