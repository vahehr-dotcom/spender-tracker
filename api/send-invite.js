import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { email, role, isPro } = req.body

  if (!email) {
    return res.status(400).json({ error: 'Email is required' })
  }

  try {
    // Generate a magic link for signup
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://spender-tracker.vercel.app'}/`
      }
    })

    if (error) throw error

    // Send custom invite email using Supabase's email
    const { error: emailError } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://spender-tracker.vercel.app'}/`,
      data: {
        invited: true,
        role: role || 'user',
        is_pro: isPro || false
      }
    })

    if (emailError) throw emailError

    // Update pending_users to mark invite as sent
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
    return res.status(500).json({ error: error.message })
  }
}