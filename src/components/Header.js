import { useNavigate } from 'react-router-dom'

export default function Header({
  userProfile,
  userEmail,
  isAdmin,
  isProMode,
  testMode,
  onTestModeToggle,
  onImport,
  onExport,
  onLogout,
  onUpgrade
}) {
  const navigate = useNavigate()

  // Get display name
  const getDisplayName = () => {
    if (userProfile?.first_name) {
      return userProfile.first_name
    }
    if (userProfile?.display_name) {
      return userProfile.display_name
    }
    return userEmail
  }

  // Get title/role if exists
  const getTitle = () => {
    return userProfile?.title || null
  }

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '20px',
      flexWrap: 'wrap',
      gap: '15px'
    }}>
      {/* Logo/Title */}
      <h1 style={{
        margin: 0,
        fontSize: '32px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent'
      }}>
        Nova Expense Tracker
      </h1>

      {/* User Greeting */}
      <div style={{
        padding: '12px 20px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '12px',
        color: 'white',
        fontWeight: 'bold',
        fontSize: '16px',
        textAlign: 'center'
      }}>
        Hello, {getDisplayName()}
        {getTitle() && ` - ${getTitle()}`}
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Admin Controls */}
        {isAdmin && (
          <>
            <button
              onClick={onTestModeToggle}
              style={{
                padding: '10px 15px',
                background: testMode ? '#6b7280' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              {testMode ? '⚙️ Basic Mode' : '✅ PRO Mode'}
            </button>
            <button
              onClick={() => navigate('/login-history')}
              style={{
                padding: '10px 15px',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              📊 Login History
            </button>
            <button
              onClick={() => navigate('/analytics')}
              style={{
                padding: '10px 15px',
                background: '#8b5cf6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              📈 Analytics
            </button>
          </>
        )}

        {/* Standard Controls */}
        <button
          onClick={onImport}
          style={{
            padding: '10px 15px',
            background: '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          📥 Import
        </button>
        <button
          onClick={onExport}
          style={{
            padding: '10px 15px',
            background: '#f59e0b',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          📤 Export
        </button>
        <button
          onClick={onLogout}
          style={{
            padding: '10px 15px',
            background: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          Logout
        </button>
      </div>
    </div>
  )
}