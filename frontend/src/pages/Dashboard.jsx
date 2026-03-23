import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout, outlookStatus as getOutlookStatus } from '../services/api';
import Sidebar from '../components/Sidebar';
import '../styles/Dashboard.css';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [outlookStatus, setOutlookStatus] = useState(null);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('papillon-theme') || 'dark';
  });
  const navigate = useNavigate();

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
      const response = await getOutlookStatus();
      if (response.data.success) {
        setOutlookStatus(response.data);
      }
    } catch (error) {
      console.error('Error fetching Outlook status:', error);
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
      desc: 'Manage Outlook connection, check status, fetch latest mail and disconnect.',
      path: '/outlook-integration'
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
      </main>
    </div>
  );
}