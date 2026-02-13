import { useState, useEffect } from 'react'

export default function Onboarding({ user, onComplete, onLogout }) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [prefilledFrom, setPrefilledFrom] = useState(null)

  useEffect(() => {
    if (user) {
      const metadata = user.user_metadata || {}
      
      let detectedFirstName = ''
      let detectedLastName = ''
      let detectedAvatar = ''
      let source = null

      // Google
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

      // Apple
      if (metadata.first_name) {
        detectedFirstName = metadata.first_name
        source = 'Apple'
      }
      if (metadata.last_name) {
        detectedLastName = metadata.last_name
      }

      // Facebook
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

      console.log('👤 OAuth data:', { metadata, detectedFirstName, detectedLastName, source })
    }
  }, [user])

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

    setIsSaving(true)
    setError('')

    try {
      await onComplete({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: user.email,
        avatar_url: avatarUrl || null
      })
    } catch (err) {
      setError('Failed to save. Please try again.')
      setIsSaving(false)
    }
  }

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
        {/* Avatar or Welcome Icon */}
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
          margin: '0 0 40px',
          fontSize: '18px',
          color: '#6b7280'
        }}>
          {prefilledFrom 
            ? `We got your info from ${prefilledFrom}. Confirm or update below.`
            : "Let's personalize your experience. What should Nova call you?"}
        </p>

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

          <div style={{ marginBottom: '30px', textAlign: 'left' }}>
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