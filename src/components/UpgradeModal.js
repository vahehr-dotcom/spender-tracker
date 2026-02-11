export default function UpgradeModal({ onClose }) {
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
      zIndex: 1000
    }}>
      <div style={{
        background: 'white',
        borderRadius: '24px',
        padding: '50px',
        maxWidth: '500px',
        textAlign: 'center',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        {/* PRO Badge */}
        <div style={{
          width: '80px',
          height: '80px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '50%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          margin: '0 auto 25px',
          fontSize: '40px'
        }}>
          🚀
        </div>

        <h2 style={{
          marginTop: 0,
          marginBottom: '15px',
          fontSize: '28px',
          fontWeight: 700,
          color: '#1f2937'
        }}>
          Upgrade to PRO
        </h2>

        <p style={{
          fontSize: '18px',
          color: '#6b7280',
          marginBottom: '30px',
          lineHeight: 1.6
        }}>
          Unlock AI Insights, Voice Commands, Smart Predictions, Custom Nicknames, and more!
        </p>

        {/* Features List */}
        <div style={{
          textAlign: 'left',
          background: '#f9fafb',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '30px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <span style={{ color: '#10b981', fontSize: '20px' }}>✓</span>
            <span style={{ color: '#374151' }}>AI-powered expense insights</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <span style={{ color: '#10b981', fontSize: '20px' }}>✓</span>
            <span style={{ color: '#374151' }}>Voice commands with Nova</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <span style={{ color: '#10b981', fontSize: '20px' }}>✓</span>
            <span style={{ color: '#374151' }}>Custom greeting & nickname</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <span style={{ color: '#10b981', fontSize: '20px' }}>✓</span>
            <span style={{ color: '#374151' }}>Unlimited custom categories</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: '#10b981', fontSize: '20px' }}>✓</span>
            <span style={{ color: '#374151' }}>Priority support</span>
          </div>
        </div>

        {/* Pricing */}
        <div style={{ marginBottom: '30px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'baseline',
            gap: '5px'
          }}>
            <span style={{
              fontSize: '48px',
              fontWeight: 'bold',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              $9.95
            </span>
            <span style={{ fontSize: '18px', color: '#6b7280' }}>/month</span>
          </div>
          <p style={{ margin: '10px 0 0', color: '#9ca3af', fontSize: '14px' }}>
            or $60/year (save 50%!)
          </p>
        </div>

        {/* CTA Buttons */}
        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: '16px 30px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '18px',
            marginBottom: '15px',
            boxShadow: '0 4px 14px rgba(102, 126, 234, 0.4)',
            transition: 'transform 0.2s'
          }}
          onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
          onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
        >
          Coming Soon!
        </button>

        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#6b7280',
            cursor: 'pointer',
            fontSize: '16px',
            padding: '10px'
          }}
        >
          Maybe Later
        </button>
      </div>
    </div>
  )
}