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
    const tables = [
      'user_activities',
      'user_sessions',
      'page_views',
      'user_preferences',
      'user_subscriptions',
      'daily_usage',
      'conversations',
      'expenses',
      'budget_goals',
      'categories',
      'categorization_log',
      'login_logs',
      'merchants',
      'proactive_notifications',
      'spending_patterns',
      'subscriptions',
      'subscriptions_detected',
      'user_category_overrides',
      'user_insights',
      'user_profiles'
    ]

    for (const table of tables) {
      const col = table === 'user_profiles' ? 'id' : 'user_id'
      await supabase.from(table).delete().eq(col, userId)
    }

    const { error: authError } = await supabase.auth.admin.deleteUser(userId)
    if (authError) throw authError

    return res.status(200).json({ success: true, message: 'User deleted' })
  } catch (error) {
    console.error('Delete user error:', error)
    return res.status(500).json({ error: error.message || 'Failed to delete user' })
  }
}