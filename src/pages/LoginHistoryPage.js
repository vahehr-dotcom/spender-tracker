import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

function LoginHistoryPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterEmail, setFilterEmail] = useState('');
  const [timeRange, setTimeRange] = useState('all');

  useEffect(() => {
    fetchSessions();
  }, [timeRange]);

  const fetchSessions = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('user_sessions')
        .select('*')
        .order('session_start', { ascending: false });

      if (timeRange !== 'all') {
        const now = new Date();
        let cutoff;
        
        if (timeRange === '24h') {
          cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        } else if (timeRange === '7d') {
          cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        } else if (timeRange === '30d') {
          cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }
        
        query = query.gte('session_start', cutoff.toISOString());
      }

      query = query.limit(100);

      const { data, error } = await query;

      if (error) throw error;

      setSessions(data || []);
    } catch (error) {
      console.error('Fetch sessions error:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString();
  };

  const formatDuration = (seconds) => {
    if (!seconds) return 'Active';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const getDeviceName = (platform) => {
    if (!platform) return 'Unknown';
    if (platform.includes('Win')) return 'Windows';
    if (platform.includes('Mac')) return 'Mac';
    if (platform.includes('Linux')) return 'Linux';
    if (platform.includes('iPhone') || platform.includes('iPad')) return 'iOS';
    if (platform.includes('Android')) return 'Android';
    return platform;
  };

  const getBrowserName = (userAgent) => {
    if (!userAgent) return 'Unknown';
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'Unknown';
  };

  const getDeviceIcon = (platform) => {
    const device = getDeviceName(platform);
    if (device === 'Windows' || device === 'Mac' || device === 'Linux') return '💻';
    if (device === 'iOS' || device === 'Android') return '📱';
    return '🖥️';
  };

  const filteredSessions = sessions.filter(log => 
    !filterEmail || log.email?.toLowerCase().includes(filterEmail.toLowerCase())
  );

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      <button 
        onClick={() => navigate('/')} 
        style={{ 
          marginBottom: '20px', 
          padding: '10px 20px', 
          cursor: 'pointer',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px'
        }}
      >
        ← Back to Dashboard
      </button>

      <h1 style={{ marginBottom: '20px' }}>Login History</h1>

      <div style={{ marginBottom: '20px', display: 'flex', gap: '15px', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Filter by Email"
          value={filterEmail}
          onChange={(e) => setFilterEmail(e.target.value)}
          style={{
            padding: '8px 12px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            width: '250px'
          }}
        />

        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          style={{
            padding: '8px 12px',
            border: '1px solid #ddd',
            borderRadius: '4px'
          }}
        >
          <option value="all">All Time</option>
          <option value="24h">Last 24 Hours</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
        </select>

        <button 
          onClick={fetchSessions}
          style={{
            padding: '8px 16px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Refresh
        </button>

        <span style={{ marginLeft: 'auto', color: '#666' }}>
          {filteredSessions.length} session(s)
        </span>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>Loading session history...</p>
        </div>
      ) : filteredSessions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          <p>No sessions found</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            backgroundColor: 'white',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                <th style={{ padding: '12px', textAlign: 'left' }}>Email</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Device</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Browser</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Timezone</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Login Time</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Duration</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredSessions.map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                  <td style={{ padding: '12px' }}>{log.email || 'Unknown'}</td>
                  <td style={{ padding: '12px' }}>
                    {getDeviceIcon(log.device_info?.platform)} {getDeviceName(log.device_info?.platform)}
                  </td>
                  <td style={{ padding: '12px' }}>{getBrowserName(log.device_info?.user_agent)}</td>
                  <td style={{ padding: '12px' }}>{log.device_info?.timezone || 'Unknown'}</td>
                  <td style={{ padding: '12px' }}>{formatDate(log.session_start)}</td>
                  <td style={{ padding: '12px' }}>{formatDuration(log.duration_seconds)}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      backgroundColor: log.session_end ? '#d4edda' : '#fff3cd',
                      color: log.session_end ? '#155724' : '#856404'
                    }}>
                      {log.session_end ? 'Ended' : 'Active'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default LoginHistoryPage;
