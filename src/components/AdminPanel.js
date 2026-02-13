import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function AdminPanel({ onClose }) {
  const [users, setUsers] = useState([])
  const [pendingUsers, setPendingUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [updating, setUpdating] = useState(null)
  const [activeTab, setActiveTab] = useState('users')
  
  // Add pending user form
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState('user')
  const [newIsPro, setNewIsPro] = useState(false)
  const [newNotes, setNewNotes] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    loadUsers()
    loadPendingUsers()
  }, [])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, email, first_name, last_name, is_pro, role, created_at')
        .order('created_at', { ascending: false })

      if (error) throw error
      setUsers(data || [])
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

  const toggleProStatus = async (userId, currentStatus) => {
    setUpdating(userId + '-pro')
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ is_pro: !currentStatus })
        .eq('id', userId)

      if (error) throw error

      setUsers(users.map(u => 
        u.id === userId ? { ...u, is_pro: !currentStatus } : u
      ))
    } catch (err) {
      console.error('Toggle PRO error:', err)
      alert('Failed to update user status')
    }
    setUpdating(null)
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
        maxWidth: '1100px',
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

        {/* Tabs */}
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

        {/* Active Users Tab */}
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
                    <th style={{ padding: '12px 16px', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>PRO Status</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(user => {
                    const roleBadge = getRoleBadge(user.role)
                    return (
                      <tr key={user.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <strong>{user.first_name} {user.last_name}</strong>
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
                          {user.is_pro ? (
                            <span style={{
                              padding: '4px 12px',
                              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                              color: 'white',
                              borderRadius: '20px',
                              fontSize: '12px',
                              fontWeight: 'bold'
                            }}>
                              ✓ PRO
                            </span>
                          ) : (
                            <span style={{
                              padding: '4px 12px',
                              background: '#e5e7eb',
                              color: '#6b7280',
                              borderRadius: '20px',
                              fontSize: '12px',
                              fontWeight: 'bold'
                            }}>
                              Basic
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
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
                            
                            <button
                              onClick={() => toggleProStatus(user.id, user.is_pro)}
                              disabled={updating === user.id + '-pro'}
                              style={{
                                padding: '6px 12px',
                                background: user.is_pro 
                                  ? '#ef4444' 
                                  : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: updating === user.id + '-pro' ? 'not-allowed' : 'pointer',
                                fontWeight: 'bold',
                                fontSize: '12px',
                                opacity: updating === user.id + '-pro' ? 0.6 : 1,
                                minWidth: '90px'
                              }}
                            >
                              {updating === user.id + '-pro'
                                ? '...' 
                                : user.is_pro 
                                  ? 'Revoke PRO' 
                                  : 'Grant PRO'}
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
        )}

        {/* Pending Users Tab */}
        {activeTab === 'pending' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {/* Add New Pending User Form */}
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

            {/* Pending Users List */}
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
                      <th style={{ padding: '12px 16px', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPending.map(user => {
                      const roleBadge = getRoleBadge(user.role)
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
          <span>PRO users: {users.filter(u => u.is_pro).length}</span>
          <span>Testers: {users.filter(u => u.role === 'tester').length}</span>
          <span>Admins: {users.filter(u => u.role === 'admin').length}</span>
          <span>Pending: {pendingUsers.length}</span>
        </div>
      </div>
    </div>
  )
}