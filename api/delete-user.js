const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { userId } = req.body

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' })
  }

  try {
    // Delete all app data in order
    await supabase.from('user_activities').delete().eq('user_id', userId)
    await supabase.from('user_sessions').delete().eq('user_id', userId)
    await supabase.from('page_views').delete().eq('user_id', userId)
    await supabase.from('user_preferences').delete().eq('user_id', userId)
    await supabase.from('user_subscriptions').delete().eq('user_id', userId)
    await supabase.from('expenses').delete().eq('user_id', userId)
    await supabase.from('budgets').delete().eq('user_id', userId)
    await supabase.from('user_profiles').delete().eq('id', userId)

    // Delete from Supabase Auth - full wipe
    const { error: authError } = await supabase.auth.admin.deleteUser(userId)
    if (authError) throw authError

    return res.status(200).json({ success: true, message: 'User deleted' })
  } catch (error) {
    console.error('Delete user error:', error)
    return res.status(500).json({ error: error.message || 'Failed to delete user' })
  }
}