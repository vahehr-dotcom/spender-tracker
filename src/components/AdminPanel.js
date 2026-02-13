import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function AdminPanel({ onClose }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [updating, setUpdating] = useState(null)

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, email, first_name, last_name, is_pro, created_at')
        .order('created_at', { ascending: false })

      if (error) throw error
      setUsers(data || [])
    } catch (err) {
      console.error('Load users error:', err)
    }
    setLoading(false)
  }

  const toggleProStatus = async (userId, currentStatus) => {
    setUpdating(userId)
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

  const filteredUsers = users.filter(user => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      user.email?.toLowerCase().includes(search) ||
      user.first_name?.toLowerCase().includes(search) ||
      user.last_name?.toLowerCase().includes(search)
    )
  })

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
        maxWidth: '900px',
        width: '100%',
        maxHeight: '80vh',
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
            👑 Admin Panel - Manage Users
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
                  <th style={{ padding: '12px 16px', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(user => (
                  <tr key={user.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <strong>{user.first_name} {user.last_name}</strong>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#6b7280' }}>
                      {user.email}
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
                      <button
                        onClick={() => toggleProStatus(user.id, user.is_pro)}
                        disabled={updating === user.id}
                        style={{
                          padding: '8px 16px',
                          background: user.is_pro 
                            ? '#ef4444' 
                            : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: updating === user.id ? 'not-allowed' : 'pointer',
                          fontWeight: 'bold',
                          fontSize: '13px',
                          opacity: updating === user.id ? 0.6 : 1
                        }}
                      >
                        {updating === user.id 
                          ? '...' 
                          : user.is_pro 
                            ? 'Revoke PRO' 
                            : 'Grant PRO'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{
          marginTop: '20px',
          padding: '12px',
          background: '#f3f4f6',
          borderRadius: '8px',
          fontSize: '14px',
          color: '#6b7280',
          textAlign: 'center'
        }}>
          Total users: {users.length} | PRO users: {users.filter(u => u.is_pro).length}
        </div>
      </div>
    </div>
  )
}