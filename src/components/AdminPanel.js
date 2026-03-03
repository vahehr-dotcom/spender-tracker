import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import subscriptionManager from '../lib/SubscriptionManager'

export default function AdminPanel({ onClose }) {
  const [users, setUsers] = useState([])
  const [pendingUsers, setPendingUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [updating, setUpdating] = useState(null)
  const [activeTab, setActiveTab] = useState('users')
  
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState('user')
  const [newIsPro, setNewIsPro] = useState(false)
  const [newNotes, setNewNotes] = useState('')
  const [adding, setAdding] = useState(false)
  const [sendingInvite, setSendingInvite] = useState(null)

  const [guestDays, setGuestDays] = useState({})

  useEffect(() => {
    loadUsers()
    loadPendingUsers()
  }, [])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const { data: profiles, error: profileError } = await supabase
        .from('user_profiles')
        .select('id, email, first_name, last_name, is_pro, role, gender, created_at')
        .order('created_at', { ascending: false })

      if (profileError) throw profileError

      const { data: subscriptions, error: subError } = await supabase
        .from('user_subscriptions')
        .select('*')

      if (subError) throw subError

      const merged = (profiles || []).map(profile => {
        const sub = (subscriptions || []).find(s => s.user_id === profile.id)
        return {
          ...profile,
          tier: sub?.tier || 'free',
          subscription_status: sub?.subscription_status || 'free',
          trial_end: sub?.trial_end || null,
          trial_used: sub?.trial_used || false,
          subscription_expires_at: sub?.subscription_expires_at || null,
          guest_granted_tier: sub?.guest_granted_tier || null
        }
      })

      setUsers(merged)
    } catch (err) {
      console.error('Load users error:', err)
    }
    setLoading(false)
  }

  const loadPendingUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('pending_users')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setPendingUsers(data || [])
    } catch (err) {
      console.error('Load pending users error:', err)
    }
  }

  const changeRole = async (userId, newRole) => {
    setUpdating(userId + '-role')
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ role: newRole })
        .eq('id', userId)

      if (error) throw error

      setUsers(users.map(u => 
        u.id === userId ? { ...u, role: newRole } : u
      ))
    } catch (err) {
      console.error('Change role error:', err)
      alert('Failed to update user role')
    }
    setUpdating(null)
  }

  const changeTier = async (userId, newTier) => {
    setUpdating(userId + '-tier')
    try {
      const { error } = await supabase
        .from('user_subscriptions')
        .update({ 
          tier: newTier, 
          subscription_status: newTier === 'free' ? 'free' : 'active',
          guest_granted_tier: null,
          subscription_expires_at: null
        })
        .eq('user_id', userId)

      if (error) throw error

      subscriptionManager.clearCache(userId)

      setUsers(users.map(u => 
        u.id === userId ? { 
          ...u, 
          tier: newTier, 
          subscription_status: newTier === 'free' ? 'free' : 'active',
          guest_granted_tier: null,
          subscription_expires_at: null
        } : u
      ))
    } catch (err) {
      console.error('Change tier error:', err)
      alert('Failed to update tier')
    }
    setUpdating(null)
  }

  const grantGuestAccess = async (userId, grantedTier, days) => {
    if (!days || days < 1) {
      alert('Please enter number of days')
      return
    }
    setUpdating(userId + '-guest')
    try {
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + parseInt(days))

      const { error } = await supabase
        .from('user_subscriptions')
        .update({
          tier: 'guest',
          subscription_status: 'active',
          guest_granted_tier: grantedTier,
          subscription_expires_at: expiresAt.toISOString()
        })
        .eq('user_id', userId)

      if (error) throw error

      subscriptionManager.clearCache(userId)

      setUsers(users.map(u => 
        u.id === userId ? { 
          ...u, 
          tier: 'guest', 
          subscription_status: 'active',
          guest_granted_tier: grantedTier,
          subscription_expires_at: expiresAt.toISOString()
        } : u
      ))
    } catch (err) {
      console.error('Grant guest error:', err)
      alert('Failed to grant guest access')
    }
    setUpdating(null)
  }

  const revokeAccess = async (userId) => {
    if (!window.confirm('Revoke this user\'s access and set to free tier?')) return
    setUpdating(userId + '-revoke')
    try {
      const { error } = await supabase
        .from('user_subscriptions')
        .update({
          tier: 'free',
          subscription_status: 'free',
          guest_granted_tier: null,
          subscription_expires_at: null
        })
        .eq('user_id', userId)

      if (error) throw error

      subscriptionManager.clearCache(userId)

      setUsers(users.map(u => 
        u.id === userId ? { 
          ...u, 
          tier: 'free', 
          subscription_status: 'free',
          guest_granted_tier: null,
          subscription_expires_at: null
        } : u
      ))
    } catch (err) {
      console.error('Revoke access error:', err)
      alert('Failed to revoke access')
    }
    setUpdating(null)
  }

  const addPendingUser = async () => {
    if (!newEmail.trim()) {
      alert('Please enter an email')
      return
    }

    setAdding(true)
    try {
      const { error } = await supabase
        .from('pending_users')
        .insert({
          email: newEmail.trim().toLowerCase(),
          role: newRole,
          is_pro: newIsPro,
          notes: newNotes.trim() || null
        })

      if (error) {
        if (error.code === '23505') {
          alert('This email is already in the pending list')
        } else {
          throw error
        }
      } else {
        setNewEmail('')
        setNewRole('user')
        setNewIsPro(false)
        setNewNotes('')
        await loadPendingUsers()
      }
    } catch (err) {
      console.error('Add pending user error:', err)
      alert('Failed to add pending user')
    }
    setAdding(false)
  }

  const deletePendingUser = async (id) => {
    if (!window.confirm('Remove this pending user?')) return

    try {
      const { error } = await supabase
        .from('pending_users')
        .delete()
        .eq('id', id)

      if (error) throw error
      setPendingUsers(pendingUsers.filter(u => u.id !== id))
    } catch (err) {
      console.error('Delete pending user error:', err)
      alert('Failed to remove pending user')
    }
  }

  const updatePendingUser = async (id, field, value) => {
    setUpdating(id + '-' + field)
    try {
      const { error } = await supabase
        .from('pending_users')
        .update({ [field]: value })
        .eq('id', id)

      if (error) throw error

      setPendingUsers(pendingUsers.map(u => 
        u.id === id ? { ...u, [field]: value } : u
      ))
    } catch (err) {
      console.error('Update pending user error:', err)
      alert('Failed to update pending user')
    }
    setUpdating(null)
  }

  const sendInvite = async (user) => {
    setSendingInvite(user.id)
    try {
      const response = await fetch('/api/send-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          role: user.role,
          isPro: user.is_pro
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send invite')
      }

      setPendingUsers(pendingUsers.map(u => 
        u.id === user.id ? { ...u, invite_sent: true, invite_sent_at: new Date().toISOString() } : u
      ))

      alert('Invite sent successfully!')
    } catch (err) {
      console.error('Send invite error:', err)
      alert('Failed to send invite: ' + err.message)
    }
    setSendingInvite(null)
  }

  const filteredUsers = users.filter(user => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      user.email?.toLowerCase().includes(search) ||
      user.first_name?.toLowerCase().includes(search) ||
      user.last_name?.toLowerCase().includes(search)
    )
  })

  const filteredPending = pendingUsers.filter(user => {
    if (!searchTerm) return true
    return user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  })

  const getTierBadge = (user) => {
    const tier = user.tier || 'free'
    switch (tier) {
      case 'admin':
        return { bg: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)', label: '👑 Admin' }
      case 'tester':
        return { bg: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', label: '🧪 Tester' }
      case 'max':
        return { bg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', label: '⭐ MAX' }
      case 'pro':
        return { bg: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', label: '✓ PRO' }
      case 'guest':
        return { bg: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', label: `🎟️ Guest (${user.guest_granted_tier?.toUpperCase() || 'PRO'})` }
      default:
        return { bg: '#e5e7eb', label: 'Free', textColor: '#6b7280' }
    }
  }

  const getTrialInfo = (user) => {
    if (!user.trial_end) return null
    const trialEnd = new Date(user.trial_end)
    const now = new Date()
    if (user.trial_used) return { status: 'used', label: 'Trial used' }
    if (trialEnd > now) {
      const daysLeft = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24))
      return { status: 'active', label: `Trial: ${daysLeft}d left` }
    }
    return { status: 'expired', label: 'Trial expired' }
  }

  const getExpirationInfo = (user) => {
    if (!user.subscription_expires_at) return null
    const expires = new Date(user.subscription_expires_at)
    const now = new Date()
    if (expires > now) {
      const daysLeft = Math.ceil((expires - now) / (1000 * 60 * 60 * 24))
      return `Expires in ${daysLeft}d`
    }
    return 'Expired'
  }

  const getRoleBadge = (role) => {
    switch (role) {
      case 'admin':
        return { bg: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)', label: '👑 Admin' }
      case 'tester':
        return { bg: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', label: '🧪 Tester' }
      default:
        return { bg: '#e5e7eb', label: 'User', textColor: '#6b7280' }
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '30px',
        maxWidth: '1200px',
        width: '100%',
        maxHeight: '85vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h2 style={{ margin: 0, fontSize: '24px' }}>
            👑 Admin Panel
          </h2>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              background: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            ✕ Close
          </button>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <button
            onClick={() => setActiveTab('users')}
            style={{
              padding: '10px 20px',
              background: activeTab === 'users' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#e5e7eb',
              color: activeTab === 'users' ? 'white' : '#6b7280',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            👥 Active Users ({users.length})
          </button>
          <button
            onClick={() => setActiveTab('subscriptions')}
            style={{
              padding: '10px 20px',
              background: activeTab === 'subscriptions' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#e5e7eb',
              color: activeTab === 'subscriptions' ? 'white' : '#6b7280',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            💳 Subscriptions
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            style={{
              padding: '10px 20px',
              background: activeTab === 'pending' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#e5e7eb',
              color: activeTab === 'pending' ? 'white' : '#6b7280',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            ⏳ Pending Invites ({pendingUsers.length})
          </button>
        </div>

        <input
          type="text"
          placeholder="Search by email or name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            padding: '12px 16px',
            fontSize: '16px',
            border: '2px solid #e5e7eb',
            borderRadius: '8px',
            marginBottom: '20px',
            width: '100%',
            boxSizing: 'border-box'
          }}
        />

        {activeTab === 'users' && (
          <div style={{
            flex: 1,
            overflowY: 'auto',
            border: '1px solid #e5e7eb',
            borderRadius: '8px'
          }}>
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                Loading users...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                No users found
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f3f4f6' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>User</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Email</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Role</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Tier</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(user => {
                    const roleBadge = getRoleBadge(user.role)
                    const tierBadge = getTierBadge(user)
                    return (
                      <tr key={user.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <strong>{user.first_name} {user.last_name}</strong>
                          {user.gender && (
                            <span style={{ fontSize: '11px', color: '#9ca3af', marginLeft: '6px' }}>
                              ({user.gender})
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#6b7280' }}>
                          {user.email}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <span style={{
                            padding: '4px 12px',
                            background: roleBadge.bg,
                            color: roleBadge.textColor || 'white',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: 'bold'
                          }}>
                            {roleBadge.label}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <span style={{
                            padding: '4px 12px',
                            background: tierBadge.bg,
                            color: tierBadge.textColor || 'white',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: 'bold'
                          }}>
                            {tierBadge.label}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <select
                            value={user.role || 'user'}
                            onChange={(e) => changeRole(user.id, e.target.value)}
                            disabled={updating === user.id + '-role'}
                            style={{
                              padding: '6px 10px',
                              borderRadius: '6px',
                              border: '1px solid #d1d5db',
                              fontSize: '13px',
                              cursor: 'pointer',
                              background: 'white'
                            }}
                          >
                            <option value="user">User</option>
                            <option value="tester">Tester</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'subscriptions' && (
          <div style={{
            flex: 1,
            overflowY: 'auto',
            border: '1px solid #e5e7eb',
            borderRadius: '8px'
          }}>
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                Loading...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                No users found
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f3f4f6' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>User</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Current Tier</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Status</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Change Tier</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Guest Access</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(user => {
                    const tierBadge = getTierBadge(user)
                    const trialInfo = getTrialInfo(user)
                    const expirationInfo = getExpirationInfo(user)
                    return (
                      <tr key={user.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <strong>{user.first_name} {user.last_name}</strong>
                          <div style={{ fontSize: '12px', color: '#9ca3af' }}>{user.email}</div>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <span style={{
                            padding: '4px 12px',
                            background: tierBadge.bg,
                            color: tierBadge.textColor || 'white',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            display: 'inline-block'
                          }}>
                            {tierBadge.label}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <div style={{ fontSize: '12px' }}>
                            <span style={{
                              color: user.subscription_status === 'active' ? '#10b981' 
                                : user.subscription_status === 'trial' ? '#f59e0b' 
                                : '#6b7280'
                            }}>
                              {user.subscription_status || 'free'}
                            </span>
                            {trialInfo && (
                              <div style={{
                                fontSize: '11px',
                                color: trialInfo.status === 'active' ? '#f59e0b' 
                                  : trialInfo.status === 'expired' ? '#ef4444' 
                                  : '#9ca3af',
                                marginTop: '2px'
                              }}>
                                {trialInfo.label}
                              </div>
                            )}
                            {expirationInfo && (
                              <div style={{
                                fontSize: '11px',
                                color: expirationInfo === 'Expired' ? '#ef4444' : '#8b5cf6',
                                marginTop: '2px'
                              }}>
                                {expirationInfo}
                              </div>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <select
                            value={user.tier || 'free'}
                            onChange={(e) => changeTier(user.id, e.target.value)}
                            disabled={updating === user.id + '-tier'}
                            style={{
                              padding: '6px 10px',
                              borderRadius: '6px',
                              border: '1px solid #d1d5db',
                              fontSize: '13px',
                              cursor: 'pointer',
                              background: 'white'
                            }}
                          >
                            <option value="free">Free</option>
                            <option value="pro">PRO</option>
                            <option value="max">MAX</option>
                            <option value="tester">Tester</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'center' }}>
                            <input
                              type="number"
                              min="1"
                              max="365"
                              placeholder="Days"
                              value={guestDays[user.id] || ''}
                              onChange={(e) => setGuestDays({ ...guestDays, [user.id]: e.target.value })}
                              style={{
                                width: '60px',
                                padding: '6px',
                                borderRadius: '6px',
                                border: '1px solid #d1d5db',
                                fontSize: '12px',
                                textAlign: 'center'
                              }}
                            />
                            <button
                              onClick={() => grantGuestAccess(user.id, 'pro', guestDays[user.id])}
                              disabled={updating === user.id + '-guest' || !guestDays[user.id]}
                              style={{
                                padding: '6px 8px',
                                background: !guestDays[user.id] ? '#e5e7eb' : 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                                color: !guestDays[user.id] ? '#9ca3af' : 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: !guestDays[user.id] ? 'not-allowed' : 'pointer',
                                fontSize: '11px',
                                fontWeight: 'bold'
                              }}
                            >
                              PRO
                            </button>
                            <button
                              onClick={() => grantGuestAccess(user.id, 'max', guestDays[user.id])}
                              disabled={updating === user.id + '-guest' || !guestDays[user.id]}
                              style={{
                                padding: '6px 8px',
                                background: !guestDays[user.id] ? '#e5e7eb' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                color: !guestDays[user.id] ? '#9ca3af' : 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: !guestDays[user.id] ? 'not-allowed' : 'pointer',
                                fontSize: '11px',
                                fontWeight: 'bold'
                              }}
                            >
                              MAX
                            </button>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          {user.tier !== 'free' && user.tier !== 'admin' && (
                            <button
                              onClick={() => revokeAccess(user.id)}
                              disabled={updating === user.id + '-revoke'}
                              style={{
                                padding: '6px 12px',
                                background: '#ef4444',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                opacity: updating === user.id + '-revoke' ? 0.6 : 1
                              }}
                            >
                              Revoke
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'pending' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <div style={{
              padding: '20px',
              background: '#f3f4f6',
              borderRadius: '8px',
              marginBottom: '20px'
            }}>
              <h3 style={{ margin: '0 0 15px 0', fontSize: '16px' }}>➕ Pre-register New User</h3>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '1', minWidth: '200px' }}>
                  <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#6b7280' }}>Email</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="user@example.com"
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div style={{ minWidth: '120px' }}>
                  <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#6b7280' }}>Role</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  >
                    <option value="user">User</option>
                    <option value="tester">Tester</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div style={{ minWidth: '100px' }}>
                  <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#6b7280' }}>PRO</label>
                  <button
                    onClick={() => setNewIsPro(!newIsPro)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      cursor: 'pointer',
                      background: newIsPro ? '#10b981' : '#e5e7eb',
                      color: newIsPro ? 'white' : '#6b7280',
                      fontWeight: 'bold'
                    }}
                  >
                    {newIsPro ? '✓ PRO' : 'Basic'}
                  </button>
                </div>
                <div style={{ flex: '1', minWidth: '150px' }}>
                  <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#6b7280' }}>Notes (optional)</label>
                  <input
                    type="text"
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder="e.g., Beta tester"
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <button
                  onClick={addPendingUser}
                  disabled={adding}
                  style={{
                    padding: '10px 20px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: adding ? 'not-allowed' : 'pointer',
                    fontWeight: 'bold',
                    opacity: adding ? 0.6 : 1
                  }}
                >
                  {adding ? 'Adding...' : 'Add User'}
                </button>
              </div>
              <p style={{ margin: '10px 0 0 0', fontSize: '12px', color: '#6b7280' }}>
                When this user signs up, they'll automatically get the role and PRO status you set here.
              </p>
            </div>

            <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px' }}>
              {filteredPending.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                  No pending users. Add one above!
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f3f4f6' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Email</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Role</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>PRO</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Notes</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Invite Status</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPending.map(user => {
                      return (
                        <tr key={user.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '12px 16px', fontWeight: '500' }}>
                            {user.email}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <select
                              value={user.role || 'user'}
                              onChange={(e) => updatePendingUser(user.id, 'role', e.target.value)}
                              disabled={updating === user.id + '-role'}
                              style={{
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: '1px solid #d1d5db',
                                fontSize: '13px',
                                cursor: 'pointer',
                                background: 'white'
                              }}
                            >
                              <option value="user">User</option>
                              <option value="tester">Tester</option>
                              <option value="admin">Admin</option>
                            </select>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <button
                              onClick={() => updatePendingUser(user.id, 'is_pro', !user.is_pro)}
                              disabled={updating === user.id + '-is_pro'}
                              style={{
                                padding: '4px 12px',
                                background: user.is_pro ? '#10b981' : '#e5e7eb',
                                color: user.is_pro ? 'white' : '#6b7280',
                                border: 'none',
                                borderRadius: '20px',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                              }}
                            >
                              {user.is_pro ? '✓ PRO' : 'Basic'}
                            </button>
                          </td>
                          <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: '13px' }}>
                            {user.notes || '-'}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            {user.invite_sent ? (
                              <span style={{ fontSize: '12px', color: '#10b981' }}>
                                ✓ Sent {formatDate(user.invite_sent_at)}
                              </span>
                            ) : (
                              <span style={{ fontSize: '12px', color: '#6b7280' }}>
                                Not sent
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                              <button
                                onClick={() => sendInvite(user)}
                                disabled={sendingInvite === user.id}
                                style={{
                                  padding: '6px 12px',
                                  background: user.invite_sent 
                                    ? '#6b7280' 
                                    : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  cursor: sendingInvite === user.id ? 'not-allowed' : 'pointer',
                                  fontSize: '12px',
                                  fontWeight: 'bold',
                                  opacity: sendingInvite === user.id ? 0.6 : 1
                                }}
                              >
                                {sendingInvite === user.id 
                                  ? 'Sending...' 
                                  : user.invite_sent 
                                    ? 'Resend' 
                                    : '📧 Send Invite'}
                              </button>
                              <button
                                onClick={() => deletePendingUser(user.id)}
                                style={{
                                  padding: '6px 12px',
                                  background: '#ef4444',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontSize: '12px'
                                }}
                              >
                                Remove
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        <div style={{
          marginTop: '20px',
          padding: '12px',
          background: '#f3f4f6',
          borderRadius: '8px',
          fontSize: '14px',
          color: '#6b7280',
          display: 'flex',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <span>Total users: {users.length}</span>
          <span>Free: {users.filter(u => u.tier === 'free').length}</span>
          <span>PRO: {users.filter(u => u.tier === 'pro').length}</span>
          <span>MAX: {users.filter(u => u.tier === 'max').length}</span>
          <span>Guests: {users.filter(u => u.tier === 'guest').length}</span>
          <span>Testers: {users.filter(u => u.tier === 'tester').length}</span>
          <span>Admins: {users.filter(u => u.tier === 'admin').length}</span>
          <span>Pending: {pendingUsers.length}</span>
        </div>
      </div>
    </div>
  )
}