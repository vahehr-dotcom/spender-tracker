import { useState } from 'react'

export default function Login({ onLogin, status }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  return (
    <div style={{ padding: 40, maxWidth: 520 }}>
      <h1>Spender Tracker</h1>

      <div style={{ marginBottom: 10 }}>
        <div>Email</div>
        <input value={email} onChange={e => setEmail(e.target.value)} />
      </div>

      <div style={{ marginBottom: 10 }}>
        <div>Password</div>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
      </div>

      <button onClick={() => onLogin(email, password)}>Login</button>

      <p>{status}</p>
    </div>
  )
}
