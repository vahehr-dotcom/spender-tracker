const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { email, role, isPro } = req.body

  if (!email) {
    return res.status(400).json({ error: 'Email is required' })
  }

  try {
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: 'https://spender-tracker.vercel.app/',
      data: {
        invited: true,
        role: role || 'user',
        is_pro: isPro || false
      }
    })

    if (error) throw error

    await supabase
      .from('pending_users')
      .update({
        invite_sent: true,
        invite_sent_at: new Date().toISOString()
      })
      .eq('email', email.toLowerCase())

    return res.status(200).json({ success: true, message: 'Invite sent!' })
  } catch (error) {
    console.error('Send invite error:', error)
    return res.status(500).json({ error: error.message || 'Failed to send invite' })
  }
}


