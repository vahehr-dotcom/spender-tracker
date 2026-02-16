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
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: 'https://spender-tracker.vercel.app/',
      data: {
        invited: true,
        role: role || 'user',
        is_pro: isPro || false
      }
    })

    if (error) throw error

    // Mark invite as sent in pending_users
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
```

**What changed:**
- Removed the redundant `generateLink` call that was running before `inviteUserByEmail` (was burning your rate limit for nothing)
- Hardcoded the redirect URL instead of relying on an env var that may not exist
- Added `|| 'Failed to send invite'` fallback so the response is always valid JSON even if `error.message` is undefined

