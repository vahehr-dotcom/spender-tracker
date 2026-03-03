import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function SettingsDrawer({ isOpen, onClose, userProfile, userId, onProfileUpdate }) {
  const [activeSection, setActiveSection] = useState('profile')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [gender, setGender] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  useEffect(() => {
    if (userProfile) {
      setFirstName(userProfile.first_name || '')
      setLastName(userProfile.last_name || '')
      setGender(userProfile.gender || '')
    }
  }, [userProfile])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  const handleSaveProfile = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      setSaveMessage('First and last name are required')
      return
    }
    setSaving(true)
    setSaveMessage('')

    try {
      const updates = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        gender: gender || null,
        updated_at: new Date().toISOString()
      }

      const { error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', userId)

      if (error) throw error

      setSaveMessage('Saved!')
      if (onProfileUpdate) {
        onProfileUpdate({ ...userProfile, ...updates })
      }
      setTimeout(() => setSaveMessage(''), 2000)
    } catch (err) {
      console.error('Save profile error:', err)
      setSaveMessage('Failed to save')
    }
    setSaving(false)
  }

  const genderOptions = [
    { value: 'male', label: '👨', sublabel: 'Male' },
    { value: 'female', label: '👩', sublabel: 'Female' },
    { value: 'other', label: '🧑', sublabel: 'Other' }
  ]

  const sections = [
    { id: 'profile', label: '👤 Profile', icon: '👤' },
    { id: 'preferences', label: '⚙️ Preferences', icon: '⚙️' },
    { id: 'subscription', label: '💳 Subscription', icon: '💳' },
    { id: 'help', label: '❓ Help & Support', icon: '❓' }
  ]

  if (!isOpen) return null

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 999,
          transition: 'opacity 0.3s'
        }}
      />

      <div style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: '420px',
        maxWidth: '90vw',
        background: 'white',
        zIndex: 1000,
        boxShadow: '-4px 0 20px rgba(0,0,0,0.15)',
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideIn 0.3s ease-out'
      }}>
        <style>{`
          @keyframes slideIn {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
        `}</style>

        <div style={{
          padding: '24px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ margin: 0, fontSize: '22px', color: '#1f2937' }}>Settings</h2>
          <button
            onClick={onClose}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              border: 'none',
              background: '#f3f4f6',
              cursor: 'pointer',
              fontSize: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6b7280'
            }}
          >
            ✕
          </button>
        </div>

        <div style={{
          display: 'flex',
          gap: '4px',
          padding: '16px 24px',
          borderBottom: '1px solid #e5e7eb',
          overflowX: 'auto'
        }}>
          {sections.map(section => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: 'none',
                background: activeSection === section.id
                  ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                  : '#f3f4f6',
                color: activeSection === section.id ? 'white' : '#6b7280',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600,
                whiteSpace: 'nowrap'
              }}
            >
              {section.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>

          {activeSection === 'profile' && (
            <div>
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                marginBottom: '24px'
              }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  background: userProfile?.avatar_url ? 'transparent' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '36px',
                  overflow: 'hidden',
                  border: userProfile?.avatar_url ? '3px solid #667eea' : 'none',
                  cursor: 'pointer'
                }}>
                  {userProfile?.avatar_url ? (
                    <img src={userProfile.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    gender === 'male' ? '👨' : gender === 'female' ? '👩' : '🧑'
                  )}
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                  Email
                </label>
                <input
                  type="text"
                  value={userProfile?.email || ''}
                  disabled
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '10px',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    background: '#f9fafb',
                    color: '#9ca3af'
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                  First Name
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '10px',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#667eea'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                  Last Name
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '10px',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#667eea'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '10px', fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                  I am
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {genderOptions.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setGender(option.value)}
                      style={{
                        flex: 1,
                        padding: '14px 10px',
                        borderRadius: '14px',
                        border: gender === option.value ? '3px solid #667eea' : '2px solid #e5e7eb',
                        background: gender === option.value ? 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)' : 'white',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '4px',
                        boxShadow: gender === option.value ? '0 4px 12px rgba(102, 126, 234, 0.25)' : 'none'
                      }}
                    >
                      <span style={{ fontSize: '28px' }}>{option.label}</span>
                      <span style={{
                        fontSize: '12px',
                        fontWeight: gender === option.value ? 700 : 500,
                        color: gender === option.value ? '#667eea' : '#6b7280'
                      }}>
                        {option.sublabel}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleSaveProfile}
                disabled={saving}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '10px',
                  border: 'none',
                  background: saving ? '#9ca3af' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  fontSize: '16px',
                  fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 14px rgba(102, 126, 234, 0.3)'
                }}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>

              {saveMessage && (
                <p style={{
                  textAlign: 'center',
                  marginTop: '12px',
                  fontSize: '14px',
                  color: saveMessage === 'Saved!' ? '#10b981' : '#ef4444',
                  fontWeight: 600
                }}>
                  {saveMessage}
                </p>
              )}
            </div>
          )}

          {activeSection === 'preferences' && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
              <p style={{ fontSize: '40px', marginBottom: '12px' }}>⚙️</p>
              <p>Preferences coming soon</p>
            </div>
          )}

          {activeSection === 'subscription' && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
              <p style={{ fontSize: '40px', marginBottom: '12px' }}>💳</p>
              <p>Subscription details coming soon</p>
            </div>
          )}

          {activeSection === 'help' && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
              <p style={{ fontSize: '40px', marginBottom: '12px' }}>❓</p>
              <p>Help & Support coming soon</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
