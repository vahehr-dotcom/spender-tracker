import { useState } from 'react'

export default function Login({ onLogin, status }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div style={{ padding: 40, maxWidth: 520 }}>
      <h1>Spender Tracker</h1>

      <div style={{ marginBottom: 10 }}>
        <div>Email</div>
        <input value={email} onChange={e => setEmail(e.target.value)} />
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ marginBottom: 5 }}>Password</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input 
            type={showPassword ? 'text' : 'password'} 
            value={password} 
            onChange={e => setPassword(e.target.value)}
            style={{ flex: 1 }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', whiteSpace: 'nowrap' }}>
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

      <button onClick={() => onLogin(email, password)}>Login</button>

      <p>{status}</p>
    </div>
  )
}
