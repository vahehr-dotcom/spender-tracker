import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Login({ onLogin, status }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleGoogleLogin = async () => {
    setIsLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      })
      if (error) {
        console.error('Google login error:', error)
        alert('Google sign-in failed: ' + error.message)
      }
    } catch (err) {
      console.error('Google login error:', err)
      alert('Google sign-in failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div style={{ 
      padding: 40, 
      maxWidth: 400, 
      margin: '60px auto',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <h1 style={{ 
        textAlign: 'center', 
        marginBottom: 30,
        fontSize: 28,
        fontWeight: 600
      }}>
        Spender Tracker
      </h1>

      {/* Google Sign-In Button */}
      <button 
        onClick={handleGoogleLogin}
        disabled={isLoading}
        style={{ 
          width: '100%',
          padding: '12px 16px',
          fontSize: 16,
          fontWeight: 500,
          border: '1px solid #ddd',
          borderRadius: 8,
          background: 'white',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          marginBottom: 24
        }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
          <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
          <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
        </svg>
        {isLoading ? 'Signing in...' : 'Continue with Google'}
      </button>

      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        margin: '20px 0',
        color: '#666'
      }}>
        <div style={{ flex: 1, height: 1, background: '#ddd' }}></div>
        <span style={{ padding: '0 12px', fontSize: 14 }}>or</span>
        <div style={{ flex: 1, height: 1, background: '#ddd' }}></div>
      </div>

      {/* Email/Password Login */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 6, fontSize: 14, fontWeight: 500 }}>Email</div>
        <input 
          type="email"
          value={email} 
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          style={{
            width: '100%',
            padding: '10px 12px',
            fontSize: 16,
            border: '1px solid #ddd',
            borderRadius: 8,
            boxSizing: 'border-box'
          }}
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ marginBottom: 6, fontSize: 14, fontWeight: 500 }}>Password</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input 
            type={showPassword ? 'text' : 'password'} 
            value={password} 
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            style={{
              flex: 1,
              padding: '10px 12px',
              fontSize: 16,
              border: '1px solid #ddd',
              borderRadius: 8,
              boxSizing: 'border-box'
            }}
          />
          <label style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 5, 
            cursor: 'pointer', 
            whiteSpace: 'nowrap',
            fontSize: 14
          }}>
            <input 
              type="checkbox" 
              checked={showPassword} 
              onChange={e => setShowPassword(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            Show
          </label>
        </div>
      </div>

      <button 
        onClick={() => onLogin(email, password)}
        style={{
          width: '100%',
          padding: '12px 16px',
          fontSize: 16,
          fontWeight: 600,
          border: 'none',
          borderRadius: 8,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          cursor: 'pointer'
        }}
      >
        Sign In
      </button>

      {status && (
        <p style={{ 
          marginTop: 16, 
          padding: 12, 
          background: status.includes('error') || status.includes('Invalid') ? '#fee' : '#efe',
          borderRadius: 8,
          fontSize: 14,
          textAlign: 'center'
        }}>
          {status}
        </p>
      )}
    </div>
  )
}