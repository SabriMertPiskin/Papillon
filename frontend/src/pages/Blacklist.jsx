import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { getBlacklist, addBlacklist, deleteBlacklist } from '../services/api';
import '../styles/Blacklist.css';

export default function Blacklist() {
  const [blacklist, setBlacklist] = useState([]);
  const [newIP, setNewIP] = useState('');
  const [reason, setReason] = useState('');
  const [domainMissing, setDomainMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
    if (!isAuthenticated) { navigate('/login'); }
    const theme = localStorage.getItem('papillon-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);

    const userRaw = localStorage.getItem('user');
    if (userRaw) {
      try {
        const parsedUser = JSON.parse(userRaw);
        setDomainMissing(!(parsedUser?.domain || '').trim());
      } catch (e) {
        setDomainMissing(true);
      }
    } else {
      setDomainMissing(true);
    }

    fetchBlacklist();
  }, [navigate]);

  const fetchBlacklist = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await getBlacklist();
      if (response.data.success) {
        setBlacklist(response.data.blacklist || []);
      } else {
        setError(response.data.detail || 'Failed to load blacklist.');
      }
    } catch (err) {
      console.error('Blacklist fetch error:', err);
      setError('Could not connect to backend. Please check your connection.');
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

    if (domainMissing) {
      setError('Please add your domain in Profile & Account first. Then you can add IP addresses to blacklist.');
      return;
    }

    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$|^([0-9a-fA-F]{1,4}:){1,7}[0-9a-fA-F]{1,4}(\/\d{1,3})?$/;
    if (!ipRegex.test(newIP.trim())) {
      setError('Please enter a valid IPv4, IPv6 or CIDR format address.');
      return;
    }

    try {
      const response = await addBlacklist(newIP.trim(), reason.trim() || 'Manual block');

      if (response.data.success) {
        setSuccess(`${newIP} successfully added to blacklist.`);
        setNewIP('');
        setReason('');
        fetchBlacklist();
      } else {
        setError(response.data.detail || 'Failed to add.');
      }
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || 'Unknown error';
      setError(detail);
    }
  };

  const handleDelete = async (id, ip) => {
    if (!window.confirm(`Remove ${ip} from the blacklist?`)) return;

    try {
      await deleteBlacklist(id);
      setSuccess(`${ip} removed from blacklist.`);
      fetchBlacklist();
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || 'Unknown error';
      setError(detail);
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
            {domainMissing && (
              <div className="bl-alert info">
                Domain-based protection is active. Add your domain first to enable blacklist additions.
                <button
                  type="button"
                  className="bl-link-btn"
                  onClick={() => navigate('/profile')}
                >
                  Go to Profile & Account
                </button>
              </div>
            )}
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
                    disabled={domainMissing}
                  />
                </div>
                <div className="form-group">
                  <label>Reason (Optional)</label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g., Port scanning detected"
                    disabled={domainMissing}
                  />
                </div>
                <button type="submit" className="add-btn" disabled={domainMissing}>
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
