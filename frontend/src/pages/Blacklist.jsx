import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import DashboardLayout from '../components/DashboardLayout';
import '../styles/Blacklist.css';

export default function Blacklist() {
  const [blacklist, setBlacklist] = useState([]);
  const [newIP, setNewIP] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  // Offline mock data for when backend is not available
  const mockData = [
    { id: 1, ip_address: '45.33.12.89', reason: 'Port scanning detected', created_at: '2026-03-18T10:30:00Z', blocked_by: 'admin' },
    { id: 2, ip_address: '185.20.10.2', reason: 'DDoS SYN flood attack', created_at: '2026-03-17T22:15:00Z', blocked_by: 'system' },
    { id: 3, ip_address: '114.114.114.114', reason: 'Suspicious DNS traffic', created_at: '2026-03-17T14:00:00Z', blocked_by: 'admin' },
    { id: 4, ip_address: '103.25.231.18', reason: 'SSH brute-force attempt', created_at: '2026-03-16T09:45:00Z', blocked_by: 'IDS' },
    { id: 5, ip_address: '192.168.1.200/24', reason: 'Internal network vulnerability', created_at: '2026-03-15T20:00:00Z', blocked_by: 'admin' },
    { id: 6, ip_address: '2001:db8::ff00:42:8329', reason: 'IPv6 anomaly detected', created_at: '2026-03-14T11:30:00Z', blocked_by: 'AI Model' },
  ];

  useEffect(() => {
    const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
    if (!isAuthenticated) { navigate('/login'); }
    const theme = localStorage.getItem('papillon-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    fetchBlacklist();
  }, [navigate]);

  const fetchBlacklist = async () => {
    setLoading(true);
    try {
      const response = await axios.get('http://localhost:8000/blacklist/', { withCredentials: true });
      if (response.data.success) {
        setBlacklist(response.data.blacklist || []);
      }
    } catch (err) {
      console.warn('Backend not reachable, loading mock data.');
      setBlacklist(mockData);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!newIP.trim()) {
      setError('Please enter an IP address.');
      return;
    }

    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$|^([0-9a-fA-F]{1,4}:){1,7}[0-9a-fA-F]{1,4}(\/\d{1,3})?$/;
    if (!ipRegex.test(newIP.trim())) {
      setError('Please enter a valid IPv4, IPv6 or CIDR format address.');
      return;
    }

    try {
      const response = await axios.post('http://localhost:8000/blacklist/add', {
        ip_address: newIP.trim(),
        reason: reason.trim() || 'Manual block'
      }, { withCredentials: true });

      if (response.data.success) {
        setSuccess(`${newIP} successfully added to blacklist.`);
        setNewIP('');
        setReason('');
        fetchBlacklist();
      } else {
        setError(response.data.detail || 'Failed to add.');
      }
    } catch (err) {
      // Offline mode — add to local
      const newItem = {
        id: Date.now(),
        ip_address: newIP.trim(),
        reason: reason.trim() || 'Manual block',
        created_at: new Date().toISOString(),
        blocked_by: 'admin (offline)'
      };
      setBlacklist(prev => [newItem, ...prev]);
      setSuccess(`${newIP} added to list (offline mode).`);
      setNewIP('');
      setReason('');
    }
  };

  const handleDelete = async (id, ip) => {
    if (!window.confirm(`Remove ${ip} from the blacklist?`)) return;

    try {
      await axios.delete(`http://localhost:8000/blacklist/${id}`, { withCredentials: true });
      setSuccess(`${ip} removed from blacklist.`);
      fetchBlacklist();
    } catch (err) {
      setBlacklist(prev => prev.filter(item => item.id !== id));
      setSuccess(`${ip} removed from list (offline mode).`);
    }
  };

  return (
    <DashboardLayout>
      <div className="blacklist-layout">
        <div className="blacklist-header">
          <div className="header-icon-wrapper">🚫</div>
          <div>
            <h1>IP Blacklist Management</h1>
            <p>Block suspicious IP addresses. IPv4, IPv6 and CIDR format supported.</p>
          </div>
        </div>

        <div className="blacklist-content">
          {/* Add Form */}
          <div className="blacklist-card add-card">
            <h2>Block New IP Address</h2>
            {error && <div className="bl-alert error">{error}</div>}
            {success && <div className="bl-alert success">{success}</div>}
            
            <form onSubmit={handleAdd} className="add-form">
              <div className="form-row">
                <div className="form-group">
                  <label>IP Address *</label>
                  <input
                    type="text"
                    value={newIP}
                    onChange={(e) => setNewIP(e.target.value)}
                    placeholder="e.g., 192.168.1.100 or 10.0.0.0/24"
                  />
                </div>
                <div className="form-group">
                  <label>Reason (Optional)</label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g., Port scanning detected"
                  />
                </div>
                <button type="submit" className="add-btn">
                  Add to Blacklist
                </button>
              </div>
            </form>
          </div>

          {/* Table */}
          <div className="blacklist-card table-card">
            <h2>Current Blacklist ({blacklist.length} entries)</h2>
            {loading ? (
              <div className="bl-loading">Loading list...</div>
            ) : blacklist.length === 0 ? (
              <div className="bl-empty">No IP addresses have been blocked yet.</div>
            ) : (
              <div className="bl-table-container">
                <table className="bl-table">
                  <thead>
                    <tr>
                      <th>IP Address</th>
                      <th>Reason</th>
                      <th>Blocked By</th>
                      <th>Date</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blacklist.map((item) => (
                      <tr key={item.id}>
                        <td className="ip-cell">{item.ip_address}</td>
                        <td>{item.reason || '—'}</td>
                        <td>{item.blocked_by || '—'}</td>
                        <td>{new Date(item.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                        <td>
                          <button 
                            className="delete-btn" 
                            onClick={() => handleDelete(item.id, item.ip_address)}
                            title="Remove"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
