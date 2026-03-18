import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { logout } from '../services/api';
import Sidebar from '../components/Sidebar';
import '../styles/Dashboard.css';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [outlookStatus, setOutlookStatus] = useState(null);
  const [loadingOutlook, setLoadingOutlook] = useState(false);
  const [latestMail, setLatestMail] = useState(null);
  const [loadingMail, setLoadingMail] = useState(false);
  const [showMailModal, setShowMailModal] = useState(false);
  const [showClientIdModal, setShowClientIdModal] = useState(false);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('papillon-theme') || 'dark';
  });
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('papillon-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      navigate('/login');
    } else {
      setUser(JSON.parse(userData));
      fetchOutlookStatus();
    }
  }, [navigate]);

  const fetchOutlookStatus = async () => {
    try {
      const response = await axios.get('http://localhost:8000/outlook/status', {
        withCredentials: true
      });
      if (response.data.success) {
        setOutlookStatus(response.data);
      }
    } catch (error) {
      console.error('Error fetching Outlook status:', error);
    }
  };

  const handleConnectOutlook = () => {
    setShowClientIdModal(true);
  };

  const handleShowHelp = () => {
    setShowHelpModal(true);
  };

  const handleSaveClientIdAndConnect = async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      alert('Please fill in both Client ID and Client Secret fields');
      return;
    }

    setLoadingOutlook(true);

    try {
      await axios.post('http://localhost:8000/outlook/save-client-id', {
        client_id: clientId,
        client_secret: clientSecret
      }, {
        withCredentials: true
      });

      const response = await axios.get('http://localhost:8000/outlook/authorize', {
        withCredentials: true
      });

      if (response.data.success) {
        window.location.href = response.data.auth_url;
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error: ' + (error.response?.data?.detail || error.message));
      setLoadingOutlook(false);
    }
  };

  const handleDisconnectOutlook = async () => {
    if (window.confirm('Are you sure you want to disconnect your Outlook account?')) {
      try {
        await axios.post('http://localhost:8000/outlook/disconnect', {}, {
          withCredentials: true
        });
        await fetchOutlookStatus();
        setLatestMail(null);
      } catch (error) {
        console.error('Error disconnecting Outlook:', error);
      }
    }
  };

  const fetchLatestMail = async () => {
    setLoadingMail(true);
    try {
      const response = await axios.get('http://localhost:8000/outlook/latest-mail', {
        withCredentials: true
      });
      if (response.data.success && response.data.email) {
        setLatestMail(response.data.email);
      }
    } catch (error) {
      console.error('Error fetching latest mail:', error.response?.data?.detail || error.message);
      alert('Mail fetch error: ' + (error.response?.data?.detail || 'Unknown error'));
    } finally {
      setLoadingMail(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('user');
      localStorage.removeItem('isAuthenticated');
      setTimeout(() => {
        window.location.href = '/login';
      }, 100);
    }
  };

  // Get time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 6) return 'Good Night';
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  // Generate simulated chart bars
  const generateBars = (count, maxHeight, colorClass) => {
    return [...Array(count)].map((_, i) => {
      const height = Math.random() * maxHeight * 0.6 + maxHeight * 0.2;
      return (
        <div
          key={i}
          className={`chart-bar ${colorClass}`}
          style={{ height: `${height}px` }}
        />
      );
    });
  };

  // Module cards data
  const moduleCards = [
    {
      icon: '🛡️',
      iconClass: 'blue',
      title: 'CVE Vulnerabilities',
      desc: 'Browse the latest CVE vulnerabilities and track security threats.',
      path: '/cve'
    },
    {
      icon: '🔐',
      iconClass: 'purple',
      title: 'Text Encryption',
      desc: 'Securely encrypt your text with AES and RSA algorithms.',
      path: '/encryption'
    },
    {
      icon: '🎯',
      iconClass: 'teal',
      title: 'Attack Surface Analysis',
      desc: 'Port scanning, DNS, SSL, subdomain enumeration and more for target domains.',
      path: '/attack-surface'
    },
    {
      icon: '🌐',
      iconClass: 'blue',
      title: 'Network Traffic Analysis',
      desc: 'Real-time network traffic analysis and anomaly/attack detection with AI models.',
      path: '/network-traffic'
    },
    {
      icon: '🦠',
      iconClass: 'red',
      title: 'Malware Analysis',
      desc: 'Analyze your files with our AI-powered engine using static/dynamic analysis to detect 0-day threats.',
      path: '/malware-analysis'
    },
    {
      icon: '🛡️',
      iconClass: 'green',
      title: 'MFA Settings',
      desc: 'Manage two-factor authentication and enhance your account security.',
      path: '/mfa-settings'
    },
    {
      icon: '📧',
      iconClass: 'orange',
      title: 'Outlook Integration',
      desc: 'Connect your Microsoft Outlook account and view email analyses.',
      action: () => outlookStatus?.is_connected ? null : handleConnectOutlook(),
      path: outlookStatus?.is_connected ? null : undefined
    },
    {
      icon: '🔑',
      iconClass: 'red',
      title: 'Password Strength Analysis',
      desc: 'AI-powered password security assessment. Detect your weak passwords.',
      path: '/password-strength'
    },
    {
      icon: '🚫',
      iconClass: 'purple',
      title: 'IP Blacklist',
      desc: 'Block suspicious IP addresses. IPv4 and IPv6 CIDR format supported.',
      path: '/blacklist'
    },
    {
      icon: '👤',
      iconClass: 'teal',
      title: 'Profile & Account',
      desc: 'View your account information, change your password, update domain.',
      path: '/profile'
    },
  ];

  if (!user) {
    return (
      <div className="dashboard-layout">
        <div className="dashboard-main" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: 'var(--auth-text-secondary)', fontSize: '1.1rem' }}>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      {/* ============ SIDEBAR ============ */}
      <Sidebar user={user} onLogout={handleLogout} />

      {/* ============ MAIN CONTENT ============ */}
      <main className="dashboard-main">
        {/* Top Bar */}
        <div className="dashboard-topbar">
          <div className="dashboard-greeting">
            <h1>{getGreeting()}, {user.username}! 👋</h1>
            <p>Welcome to your Papillon security dashboard</p>
          </div>
          <div className="topbar-actions">
            <button
              className="topbar-btn"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button
              className="topbar-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              title="Menu"
              style={{ display: 'none' }}
            >
              ☰
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="dashboard-stats">
          <div className="stat-card blue">
            <div className="stat-card-header">
              <div className="stat-icon">🛡️</div>
              <span className="stat-trend up">↑ Active</span>
            </div>
            <div className="stat-value">12</div>
            <div className="stat-label">Security Modules</div>
          </div>
          <div className="stat-card teal">
            <div className="stat-card-header">
              <div className="stat-icon">🔑</div>
            </div>
            <div className="stat-value">{user.mfa_enabled ? 'Active' : 'Inactive'}</div>
            <div className="stat-label">MFA Status</div>
          </div>
          <div className="stat-card purple">
            <div className="stat-card-header">
              <div className="stat-icon">📧</div>
            </div>
            <div className="stat-value">{outlookStatus?.is_connected ? 'Connected' : '—'}</div>
            <div className="stat-label">Outlook Status</div>
          </div>
          <div className="stat-card orange">
            <div className="stat-card-header">
              <div className="stat-icon">📅</div>
            </div>
            <div className="stat-value">{new Date(user.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}</div>
            <div className="stat-label">Registration Date</div>
          </div>
        </div>

        {/* Module Cards */}
        <div className="dashboard-modules">
          <h2>Security Modules</h2>
          <div className="modules-grid">
            {moduleCards.map((mod, i) => (
              <div
                key={i}
                className="module-card"
                onClick={() => {
                  if (mod.comingSoon) return;
                  if (mod.action) { mod.action(); return; }
                  if (mod.path) navigate(mod.path);
                }}
                style={mod.comingSoon ? { opacity: 0.6, cursor: 'default' } : {}}
              >
                <div className={`module-card-icon ${mod.iconClass}`}>{mod.icon}</div>
                <div className="module-card-title">
                  {mod.title}
                  {mod.comingSoon
                    ? <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '6px', background: 'rgba(255,152,0,0.12)', color: '#ff9800' }}>Coming Soon</span>
                    : <span className="module-arrow">→</span>
                  }
                </div>
                <div className="module-card-desc">{mod.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Chart Placeholders */}
        <div className="dashboard-charts">
          <h2>Monitoring & Analysis</h2>
          <div className="charts-grid">
            <div className="chart-card clickable" onClick={() => navigate('/network-traffic')} style={{ cursor: 'pointer', transition: 'transform 0.2s' }}>
              <div className="chart-card-header">
                <span className="chart-card-title">Network Traffic Analysis & IDS</span>
                <span style={{ fontSize: '0.8rem', color: '#4caf50', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span className="live-indicator"></span> Live Analysis
                </span>
              </div>
              <div className="chart-bars">
                {generateBars(18, 130, 'bar-blue')}
              </div>
            </div>
            <div className="chart-card clickable" onClick={() => navigate('/malware-analysis')} style={{ cursor: 'pointer', transition: 'transform 0.2s' }}>
              <div className="chart-card-header">
                <span className="chart-card-title">Threat Detection (Malware)</span>
                <span className="chart-card-badge" style={{ background: 'rgba(211, 47, 47, 0.15)', color: '#f44336' }}>Comprehensive Analysis</span>
              </div>
              <div className="chart-bars">
                {generateBars(18, 130, 'bar-teal')}
              </div>
            </div>
            <div className="chart-card clickable" onClick={() => navigate('/vulnerability-map')} style={{ cursor: 'pointer', transition: 'transform 0.2s' }}>
              <div className="chart-card-header">
                <span className="chart-card-title">Vulnerability Map</span>
                <span className="chart-card-badge" style={{ background: 'rgba(0, 198, 255, 0.15)', color: '#00c6ff' }}>Active Monitoring</span>
              </div>
              <div className="chart-placeholder" style={{ background: 'transparent', border: 'none' }}>
                <span className="chart-placeholder-icon">🗺️</span>
                <span className="chart-placeholder-text">View system topology and vulnerabilities</span>
              </div>
            </div>
            <div className="chart-card clickable" onClick={() => navigate('/phishing-history')} style={{ cursor: 'pointer', transition: 'transform 0.2s' }}>
              <div className="chart-card-header">
                <span className="chart-card-title">Phishing Alert History</span>
                <span className="chart-card-badge" style={{ background: 'rgba(255, 152, 0, 0.15)', color: '#ff9800' }}>AI Analyzed</span>
              </div>
              <div className="chart-placeholder" style={{ background: 'transparent', border: 'none' }}>
                <span className="chart-placeholder-icon">🎣</span>
                <span className="chart-placeholder-text">View past email analyses</span>
              </div>
            </div>
          </div>
        </div>

        {/* Outlook Section */}
        <div className="outlook-section">
          <div className="outlook-header">
            <div className="outlook-title">
              📧 Outlook Integration
              <span className={`outlook-status-badge ${outlookStatus?.is_connected ? 'connected' : 'disconnected'}`}>
                {outlookStatus?.is_connected ? '● Connected' : '○ Disconnected'}
              </span>
            </div>
          </div>

          {outlookStatus?.is_connected && outlookStatus.outlook_email && (
            <div className="mail-detail" style={{ marginBottom: '14px' }}>
              Connected account: <strong>{outlookStatus.outlook_email}</strong>
            </div>
          )}

          <div className="outlook-actions-row">
            {outlookStatus?.is_connected ? (
              <>
                <button
                  className="outlook-action-btn fetch-mail"
                  onClick={fetchLatestMail}
                  disabled={loadingMail}
                >
                  {loadingMail ? '⏳ Loading...' : '📩 Show Latest Mail'}
                </button>
                <button
                  className="outlook-action-btn"
                  onClick={() => navigate('/phishing-history')}
                  style={{ background: 'rgba(255, 152, 0, 0.2)', color: '#ff9800', border: '1px solid rgba(255, 152, 0, 0.4)' }}
                >
                  🎣 Phishing History
                </button>
                <button
                  className="outlook-action-btn disconnect"
                  onClick={handleDisconnectOutlook}
                >
                  ✕ Disconnect
                </button>
              </>
            ) : (
              <button
                className="outlook-action-btn connect"
                onClick={handleConnectOutlook}
                disabled={loadingOutlook}
              >
                {loadingOutlook ? '⏳ Redirecting...' : '🔗 Connect Outlook'}
              </button>
            )}
          </div>

          {latestMail && (
            <div className="latest-mail-card clickable" onClick={() => setShowMailModal(true)} style={{ cursor: 'pointer', transition: 'transform 0.2s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ margin: 0 }}>📬 Latest Mail</h4>
                <span style={{ fontSize: '0.8rem', color: 'var(--auth-accent)' }}>Click to View →</span>
              </div>
              <div className="mail-detail">
                <strong>From:</strong> {latestMail.from_name || latestMail.from}
              </div>
              <div className="mail-detail">
                <strong>Subject:</strong> {latestMail.subject || '(No subject)'}
              </div>
              <div className="mail-detail">
                <strong>Date:</strong> {new Date(latestMail.received_date).toLocaleString('en-US')}
              </div>
              <div className="mail-preview">
                <strong>Preview:</strong><br />
                {latestMail.preview || 'No content'}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ============ MODALS ============ */}

      {/* Help Modal */}
      {showHelpModal && (
        <div className="modal-overlay" onClick={() => setShowHelpModal(false)}>
          <div className="modal-content wide" onClick={(e) => e.stopPropagation()}>
            <h2>How to Get Client ID and Secret?</h2>

            <h4>Step 1: Go to Azure Portal</h4>
            <p>Open this address in your browser: <strong>https://portal.azure.com</strong></p>
            <div className="modal-code-block">
              Sign in with your Microsoft account. If you don't have one, you can sign in with your Outlook account.
            </div>

            <h4>Step 2: Find "App registrations"</h4>
            <ol>
              <li>Search for <strong>"App registrations"</strong> in the Azure Portal search bar</li>
              <li>Click on <strong>"App registrations"</strong> from the left menu</li>
            </ol>

            <h4>Step 3: Register a New Application</h4>
            <ol>
              <li>Click the <strong>"+ New registration"</strong> button</li>
              <li><strong>Name:</strong> enter your application name (e.g., "Papillon Mail")</li>
              <li><strong>Supported account types:</strong> select <strong>"Accounts in any organizational directory and personal Microsoft accounts"</strong></li>
              <li><strong>Redirect URI:</strong> select <strong>Web</strong></li>
              <li>Enter the URI: <strong>http://localhost:8000/outlook/callback</strong></li>
              <li>Click the <strong>Register</strong> button</li>
            </ol>

            <h4>Step 4: Copy the Client ID</h4>
            <ol>
              <li>You will be on the detail page of the newly created application</li>
              <li>Copy the code next to the <strong>"Application (client) ID"</strong> label</li>
              <li>Paste it into the <strong>"Client ID"</strong> field</li>
            </ol>

            <h4>Step 5: Get the Client Secret</h4>
            <ol>
              <li>Click <strong>"Certificates & secrets"</strong> in the left menu</li>
              <li>Click the <strong>"+ New client secret"</strong> button</li>
              <li>Select <strong>"24 months"</strong> for <strong>Expires</strong></li>
              <li>Click the <strong>Add</strong> button</li>
              <li>Copy the code in the <strong>"Value"</strong> column of the created secret</li>
              <li><strong>CAUTION: Save this code somewhere, it cannot be accessed again!</strong></li>
            </ol>

            <h4>Step 6: Set Permissions (Optional)</h4>
            <ol>
              <li>Click <strong>"API permissions"</strong> in the left menu</li>
              <li>Check the <strong>"Mail.Read"</strong> and <strong>"User.Read"</strong> permissions</li>
            </ol>

            <button
              className="modal-btn primary full-width"
              onClick={() => setShowHelpModal(false)}
              style={{ marginTop: '20px' }}
            >
              Got It, Close
            </button>
          </div>
        </div>
      )}

      {/* Mail Detail Modal */}
      {showMailModal && latestMail && (
        <div className="modal-overlay" onClick={() => setShowMailModal(false)}>
          <div className="modal-content wide" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <h2 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.5rem' }}>📧</span> Email Details
            </h2>
            
            <div style={{ background: 'var(--auth-input-bg, rgba(10, 22, 40, 0.6))', padding: '16px', borderRadius: '12px', marginBottom: '20px', border: '1px solid var(--auth-glass-border)' }}>
              <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <strong>From:</strong> {latestMail.from_name} ({latestMail.from})
              </div>
              <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <strong>Date:</strong> {new Date(latestMail.received_date).toLocaleString('en-US')}
              </div>
              <div>
                <strong>Subject:</strong> <span style={{ color: 'var(--auth-text-primary)' }}>{latestMail.subject || '(No subject)'}</span>
              </div>
            </div>

            <div style={{ 
              background: 'rgba(0,0,0,0.2)', 
              padding: '20px', 
              borderRadius: '12px', 
              minHeight: '200px',
              color: 'var(--auth-text-primary)',
              lineHeight: '1.6',
              whiteSpace: 'pre-wrap',
              border: '1px solid rgba(255,255,255,0.05)',
              marginBottom: '24px'
            }}>
              {latestMail.body || latestMail.preview || 'Could not retrieve mail content.'}
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                className="modal-btn" 
                onClick={() => {
                  alert("⚠️ AI Phishing Analysis module is not yet connected on the backend.");
                  setShowMailModal(false);
                }} 
                style={{ background: 'rgba(244, 67, 54, 0.1)', color: '#ef5350', border: '1px solid rgba(244, 67, 54, 0.3)' }}
              >
                🤖 Run AI Phishing Scan
              </button>
              <button className="modal-btn primary" onClick={() => setShowMailModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Client ID Modal */}
      {showClientIdModal && (
        <div className="modal-overlay" onClick={() => setShowClientIdModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>Outlook Connection</h3>
              <button
                className="topbar-btn"
                onClick={handleShowHelp}
                title="How do I get these?"
                style={{ width: '32px', height: '32px', fontSize: '14px', borderRadius: '50%' }}
              >
                ?
              </button>
            </div>

            <div className="modal-input-group">
              <label>Client ID *</label>
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="Your Client ID from Azure"
              />
            </div>

            <div className="modal-input-group">
              <label>Client Secret *</label>
              <input
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="Your Client Secret from Azure"
              />
            </div>

            <div className="modal-actions">
              <button
                className="modal-btn secondary"
                onClick={() => setShowClientIdModal(false)}
                disabled={loadingOutlook}
              >
                Cancel
              </button>
              <button
                className="modal-btn primary"
                onClick={handleSaveClientIdAndConnect}
                disabled={loadingOutlook}
              >
                {loadingOutlook ? 'Connecting...' : 'Connect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}