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
  onOpenAdmin,
  onOpenSettings,
  userFeatures
}) {
  const navigate = useNavigate()

  const getDisplayName = () => {
    if (userProfile?.first_name) {
      return userProfile.first_name
    }
    if (userProfile?.display_name) {
      return userProfile.display_name
    }
    return userEmail
  }

  const getTitle = () => {
    return userProfile?.title || null
  }

  const getAvatarContent = () => {
    if (userProfile?.avatar_url) {
      return <img src={userProfile.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
    }
    const gender = userProfile?.gender
    return gender === 'male' ? '👨' : gender === 'female' ? '👩' : '🧑'
  }

  const tier = userFeatures?.tier || 'free'
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
        onMouseOut={(e) => e.currentTarget.styl