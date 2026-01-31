import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function LoginHistory({ onBack }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterEmail, setFilterEmail] = useState('')
  const [timeRange, setTimeRange] = useState('all')

  useEffect(() => {
    loadLogs()
  }, [timeRange, filterEmail])

  const loadLogs = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('login_logs')
        .select('*')
        .order('logged_in_at', { ascending: false })

      // Filter by email
      if (filterEmail) {
        query = query.ilike('email', `%${filterEmail}%`)
      }

      // Filter by time range
      if (timeRange !== 'all') {
        const now = new Date()
        let cutoff = new Date()
        
        if (timeRange === '24h') cutoff.setHours(now.getHours() - 24)
        else if (timeRange === '7d') cutoff.setDate(now.getDate() - 7)
        else if (timeRange === '30d') cutoff.setDate(now.getDate() - 30)

        query = query.gte('logged_in_at', cutoff.toISOString())
      }

      const { data, error } = await query.limit(100)

      if (error) throw error
      setLogs(data || [])
    } catch (err) {
      console.error('Failed to load login logs:', err)
      alert('Failed to load login history')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (timestamp) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays}d ago`
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getDeviceIcon = (platform) => {
    const p = platform?.toLowerCase() || ''
    if (p.includes('win')) return '🖥️'
    if (p.includes('mac')) return '💻'
    if (p.includes('iphone') || p.includes('ipad')) return '📱'
    if (p.includes('android')) return '📱'
    if (p.includes('linux')) return '🐧'
    return '💻'
  }

  const getDeviceName = (platform) => {
    const p = platform?.toLowerCase() || ''
    if (p.includes('win')) return 'Windows'
    if (p.includes('mac')) return 'Mac'
    if (p.includes('iphone')) return 'iPhone'
    if (p.includes('ipad')) return 'iPad'
    if (p.includes('android')) return 'Android'
    if (p.includes('linux')) return 'Linux'
    return 'Unknown'
  }

  const getBrowserName = (userAgent) => {
    const ua = userAgent?.toLowerCase() || ''
    if (ua.includes('chrome') && !ua.includes('edg')) return 'Chrome'
    if (ua.includes('safari') && !ua.includes('chrome')) return 'Safari'
    if (ua.includes('firefox')) return 'Firefox'
    if (ua.includes('edg')) return 'Edge'
    return 'Browser'
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif', maxWidth: 1400 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 }}>
        <h1 style={{ margin: 0 }}>🔐 Login History</h1>
        <button
          onClick={onBack}
          style={{
            padding: '8px 16px',
            background: '#666',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          ← Back
        </button>
      </div>

      <div style={{
        background: '#f5f5f5',
        padding: 20,
        borderRadius: 8,
        marginBottom: 20,
        display: 'flex',
        gap: 15,
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <div>
          <label style={{ fontSize: 14, fontWeight: 'bold', marginRight: 8 }}>Filter by Email:</label>
          <input
            type="text"
            value={filterEmail}
            onChange={(e) => setFilterEmail(e.target.value)}
            placeholder="Search email..."
            style={{
              padding: '8px 12px',
              border: '1px solid #ddd',
              borderRadius: 6,
              fontSize: 14
            }}
          />
        </div>

        <div>
          <label style={{ fontSize: 14, fontWeight: 'bold', marginRight: 8 }}>Time Range:</label>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            style={{
              padding: '8px 12px',
              border: '1px solid #ddd',
              borderRadius: 6,
              fontSize: 14,
              cursor: 'pointer'
            }}
          >
            <option value="all">All Time</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
        </div>

        <button
          onClick={loadLogs}
          style={{
            padding: '8px 16px',
            background: '#4caf50',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          🔄 Refresh
        </button>

        <div style={{ marginLeft: 'auto', fontSize: 14, color: '#666' }}>
          <strong>{logs.length}</strong> login{logs.length !== 1 ? 's' : ''}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
          Loading login history...
        </div>
      ) : logs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
          No logins found
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: 8, overflow: 'hidden', border: '1px solid #ddd' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9f9f9', borderBottom: '2px solid #ddd' }}>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold' }}>Email</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold' }}>Device</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold' }}>Browser</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold' }}>Timezone</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold' }}>When</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, index) => (
                <tr
                  key={log.id}
                  style={{
                    borderBottom: index < logs.length - 1 ? '1px solid #eee' : 'none',
                    background: index % 2 === 0 ? 'white' : '#fafafa'
                  }}
                >
                  <td style={{ padding: '12px', fontWeight: '500' }}>
                    {log.email}
                  </td>
                  <td style={{ padding: '12px' }}>
                    {getDeviceIcon(log.device_info?.platform)} {getDeviceName(log.device_info?.platform)}
                  </td>
                  <td style={{ padding: '12px', fontSize: 14, color: '#666' }}>
                    {getBrowserName(log.device_info?.user_agent)}
                  </td>
                  <td style={{ padding: '12px', fontSize: 14, color: '#666' }}>
                    {log.device_info?.timezone || 'Unknown'}
                  </td>
                  <td style={{ padding: '12px', fontSize: 14, color: '#666' }}>
                    {formatDate(log.logged_in_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}