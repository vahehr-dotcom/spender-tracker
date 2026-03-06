import { useNavigate } from 'react-router-dom'

export default function Header({
  userProfile,
  userEmail,
  isAdmin,
  isTester,
  isProMode,
  testMode,
  onTestModeToggle,
  onImport,
  onExport,
  onLogout,
  onUpgrade,
  onOpenSettings,
  userFeatures
}) {
  const navigate = useNavigate()

  const getDisplayName = () => {
    if (userProfile?.first_name) return userProfile.first_name
    if (userProfile?.display_name) return userProfile.display_name
    return userEmail
  }

  const getTitle = () => userProfile?.title || null

  const getAvatarContent = () => {
    if (userProfile?.avatar_url) {
      return <img src={userProfile.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
    }
    const gender = userProfile?.gender
    return gender === 'male' ? '👨' : gender === 'female' ? '👩' : '🧑'
  }

  const tier = userFeatures?.tier || 'free'
  const isFree = tier === 'free'

  const tierConfig = {
    free: null,
    pro: { label: 'PRO', bg: 'rgba(16, 185, 129, 0.9)' },
    max: { label: 'MAX', bg: 'rgba(245, 158, 11, 0.9)' },
    admin: { label: 'ADMIN', bg: 'rgba(236, 72, 153, 0.9)' },
    tester: { label: 'TESTER', bg: 'rgba(59, 130, 246, 0.9)' },
    guest: { label: 'GUEST', bg: 'rgba(139, 92, 246, 0.9)' }
  }
  const badge = tierConfig[tier]

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '20px',
      flexWrap: 'wrap',
      gap: '15px'
    }}>
      <h1 style={{
        margin: 0,
        fontSize: '32px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent'
      }}>
        Nova Expense Tracker
      </h1>

      <div
        onClick={onOpenSettings}
        style={{
          padding: '8px 20px 8px 8px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '40px',
          color: 'white',
          fontWeight: 'bold',
          fontSize: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          cursor: 'pointer',
          transition: 'transform 0.2s, box-shadow 0.2s',
          boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)'
        }}
        onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
        onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
      >
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '20px',
          overflow: 'hidden'
        }}>
          {getAvatarContent()}
        </div>
        <span>
          {getDisplayName()}
          {getTitle() && ` - ${getTitle()}`}
        </span>
        {badge && (
          <span style={{
            padding: '3px 8px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 700,
            background: badge.bg,
            color: 'white',
            letterSpacing: '0.5px'
          }}>
            {badge.label}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        {isTester && (
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
        )}

        {isAdmin && (
          <button
            onClick={() => navigate('/admin')}
            style={{
              padding: '10px 15px',
              background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            👑 Admin
          </button>
        )}

        {!isFree && (
          <>
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
          </>
        )}
      </div>
    </div>
  )
}