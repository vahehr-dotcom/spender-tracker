import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function AnalyticsDashboard({ onBack }) {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeToday: 0,
    activeThisWeek: 0,
    avgSessionDuration: 0,
    totalPageViews: 0,
    totalActivities: 0
  })

  const [recentActivity, setRecentActivity] = useState([])
  const [topPages, setTopPages] = useState([])
  const [topActivities, setTopActivities] = useState([])
  const [userEngagement, setUserEngagement] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshInterval, setRefreshInterval] = useState(null)

  useEffect(() => {
    loadAnalytics()

    // Auto-refresh every 10 seconds
    const interval = setInterval(() => {
      loadAnalytics()
    }, 10000)

    setRefreshInterval(interval)

    return () => clearInterval(interval)
  }, [])

  const loadAnalytics = async () => {
    try {
      // Total users
      const { data: users } = await supabase
        .from('user_preferences')
        .select('user_id')
        .eq('preference_type', 'role')

      const uniqueUsers = [...new Set(users?.map(u => u.user_id) || [])]

      // Active today
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const { data: activeToday } = await supabase
        .from('user_sessions')
        .select('user_id')
        .gte('session_start', today.toISOString())

      const uniqueActiveToday = [...new Set(activeToday?.map(u => u.user_id) || [])]

      // Active this week
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)

      const { data: activeWeek } = await supabase
        .from('user_sessions')
        .select('user_id')
        .gte('session_start', weekAgo.toISOString())

      const uniqueActiveWeek = [...new Set(activeWeek?.map(u => u.user_id) || [])]

      // Avg session duration
      const { data: sessions } = await supabase
        .from('user_sessions')
        .select('duration_seconds')
        .not('duration_seconds', 'is', null)
        .gte('session_start', weekAgo.toISOString())

      const avgDuration = sessions?.length > 0
        ? sessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0) / sessions.length
        : 0

      // Total page views (last 7 days)
      const { data: pageViews, count: pageViewCount } = await supabase
        .from('page_views')
        .select('*', { count: 'exact' })
        .gte('viewed_at', weekAgo.toISOString())

      // Total activities (last 7 days)
      const { data: activities, count: activityCount } = await supabase
        .from('user_activities')
        .select('*', { count: 'exact' })
        .gte('created_at', weekAgo.toISOString())

      setStats({
        totalUsers: uniqueUsers.length,
        activeToday: uniqueActiveToday.length,
        activeThisWeek: uniqueActiveWeek.length,
        avgSessionDuration: Math.round(avgDuration),
        totalPageViews: pageViewCount || 0,
        totalActivities: activityCount || 0
      })

      // Recent activity feed (last 20)
      const { data: recentAct } = await supabase
        .from('user_activities')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)

      setRecentActivity(recentAct || [])

      // Top pages
      const { data: pages } = await supabase
        .from('page_views')
        .select('page_name')
        .gte('viewed_at', weekAgo.toISOString())

      const pageCounts = {}
      pages?.forEach(p => {
        pageCounts[p.page_name] = (pageCounts[p.page_name] || 0) + 1
      })

      const topPagesData = Object.entries(pageCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)

      setTopPages(topPagesData)

      // Top activities
      const actCounts = {}
      activities?.forEach(a => {
        actCounts[a.activity_type] = (actCounts[a.activity_type] || 0) + 1
      })

      const topActData = Object.entries(actCounts)
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)

      setTopActivities(topActData)

      // User engagement (sessions per user)
      const { data: allSessions } = await supabase
        .from('user_sessions')
        .select('user_id, email, duration_seconds')
        .gte('session_start', weekAgo.toISOString())

      const userStats = {}
      allSessions?.forEach(s => {
        if (!userStats[s.email]) {
          userStats[s.email] = { email: s.email, sessions: 0, totalTime: 0 }
        }
        userStats[s.email].sessions++
        userStats[s.email].totalTime += s.duration_seconds || 0
      })

      const engagementData = Object.values(userStats)
        .sort((a, b) => b.sessions - a.sessions)

      setUserEngagement(engagementData)

      setLoading(false)
    } catch (err) {
      console.error('Analytics error:', err)
      setLoading(false)
    }
  }

  const formatDuration = (seconds) => {
    if (!seconds) return '0s'
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) return `${hours}h ${mins}m`
    if (mins > 0) return `${mins}m ${secs}s`
    return `${secs}s`
  }

  const formatActivityType = (type) => {
    return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  }

  const getActivityIcon = (type) => {
    if (type.includes('add')) return '➕'
    if (type.includes('update')) return '✏️'
    if (type.includes('delete')) return '🗑️'
    if (type.includes('import')) return '📥'
    if (type.includes('export')) return '📤'
    if (type.includes('search')) return '🔍'
    if (type.includes('login') || type.includes('logout')) return '🔐'
    if (type.includes('idle')) return '😴'
    return '🎯'
  }

  const formatTimeAgo = (timestamp) => {
    const now = new Date()
    const time = new Date(timestamp)
    const diffMs = now - time
    const diffSecs = Math.floor(diffMs / 1000)
    const diffMins = Math.floor(diffSecs / 60)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffSecs < 60) return `${diffSecs}s ago`
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  if (loading) {
    return (
      <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
        <h1>📊 Analytics Dashboard</h1>
        <p>Loading analytics...</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif', maxWidth: 1600 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 }}>
        <h1 style={{ margin: 0 }}>📊 Analytics Dashboard</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={loadAnalytics}
            style={{
              padding: '8px 16px',
              background: '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            🔄 Refresh
          </button>
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
      </div>

      {/* Key Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 30 }}>
        <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', padding: 20, borderRadius: 12 }}>
          <div style={{ fontSize: 14, opacity: 0.9 }}>Total Users</div>
          <div style={{ fontSize: 36, fontWeight: 'bold', marginTop: 8 }}>{stats.totalUsers}</div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white', padding: 20, borderRadius: 12 }}>
          <div style={{ fontSize: 14, opacity: 0.9 }}>Active Today</div>
          <div style={{ fontSize: 36, fontWeight: 'bold', marginTop: 8 }}>{stats.activeToday}</div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', color: 'white', padding: 20, borderRadius: 12 }}>
          <div style={{ fontSize: 14, opacity: 0.9 }}>Active This Week</div>
          <div style={{ fontSize: 36, fontWeight: 'bold', marginTop: 8 }}>{stats.activeThisWeek}</div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', color: 'white', padding: 20, borderRadius: 12 }}>
          <div style={{ fontSize: 14, opacity: 0.9 }}>Avg Session</div>
          <div style={{ fontSize: 36, fontWeight: 'bold', marginTop: 8 }}>{formatDuration(stats.avgSessionDuration)}</div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', color: 'white', padding: 20, borderRadius: 12 }}>
          <div style={{ fontSize: 14, opacity: 0.9 }}>Page Views (7d)</div>
          <div style={{ fontSize: 36, fontWeight: 'bold', marginTop: 8 }}>{stats.totalPageViews}</div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)', color: 'white', padding: 20, borderRadius: 12 }}>
          <div style={{ fontSize: 14, opacity: 0.9 }}>Activities (7d)</div>
          <div style={{ fontSize: 36, fontWeight: 'bold', marginTop: 8 }}>{stats.totalActivities}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Top Pages */}
        <div style={{ background: 'white', border: '1px solid #ddd', borderRadius: 12, padding: 20 }}>
          <h3 style={{ marginTop: 0 }}>📄 Top Pages (7 days)</h3>
          {topPages.length === 0 ? (
            <p style={{ color: '#999' }}>No page views yet</p>
          ) : (
            <div>
              {topPages.map((page, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < topPages.length - 1 ? '1px solid #eee' : 'none' }}>
                  <span style={{ fontWeight: '500' }}>{page.name}</span>
                  <span style={{ background: '#667eea', color: 'white', padding: '2px 10px', borderRadius: 12, fontSize: 13 }}>{page.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Activities */}
        <div style={{ background: 'white', border: '1px solid #ddd', borderRadius: 12, padding: 20 }}>
          <h3 style={{ marginTop: 0 }}>🎯 Top Activities (7 days)</h3>
          {topActivities.length === 0 ? (
            <p style={{ color: '#999' }}>No activities yet</p>
          ) : (
            <div>
              {topActivities.map((act, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < topActivities.length - 1 ? '1px solid #eee' : 'none' }}>
                  <span>
                    {getActivityIcon(act.type)} {formatActivityType(act.type)}
                  </span>
                  <span style={{ background: '#4caf50', color: 'white', padding: '2px 10px', borderRadius: 12, fontSize: 13 }}>{act.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* User Engagement */}
        <div style={{ background: 'white', border: '1px solid #ddd', borderRadius: 12, padding: 20 }}>
          <h3 style={{ marginTop: 0 }}>👥 User Engagement (7 days)</h3>
          {userEngagement.length === 0 ? (
            <p style={{ color: '#999' }}>No user data yet</p>
          ) : (
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {userEngagement.map((user, i) => (
                <div key={i} style={{ padding: '12px 0', borderBottom: i < userEngagement.length - 1 ? '1px solid #eee' : 'none' }}>
                  <div style={{ fontWeight: '500', marginBottom: 4 }}>{user.email}</div>
                  <div style={{ fontSize: 13, color: '#666' }}>
                    {user.sessions} session{user.sessions !== 1 ? 's' : ''} • {formatDuration(user.totalTime)} total
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Real-time Activity Feed */}
        <div style={{ background: 'white', border: '1px solid #ddd', borderRadius: 12, padding: 20 }}>
          <h3 style={{ marginTop: 0 }}>📡 Real-time Activity Feed</h3>
          {recentActivity.length === 0 ? (
            <p style={{ color: '#999' }}>No recent activity</p>
          ) : (
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {recentActivity.map((act, i) => (
                <div key={act.id} style={{ padding: '12px 0', borderBottom: i < recentActivity.length - 1 ? '1px solid #eee' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 18 }}>{getActivityIcon(act.activity_type)}</span>
                    <span style={{ fontWeight: '500', fontSize: 14 }}>{formatActivityType(act.activity_type)}</span>
                    <span style={{ fontSize: 12, color: '#999', marginLeft: 'auto' }}>{formatTimeAgo(act.created_at)}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#666', marginLeft: 26 }}>
                    {act.email} • {act.page_name}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 20, padding: 12, background: '#f0f0f0', borderRadius: 8, fontSize: 13, color: '#666', textAlign: 'center' }}>
        Auto-refreshes every 10 seconds • Last updated: {new Date().toLocaleTimeString()}
      </div>
    </div>
  )
}