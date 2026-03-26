import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout, outlookStatus as getOutlookStatus } from '../services/api';
import Sidebar from '../components/Sidebar';
import { canManageVM } from '../utils/roleUtils';
import '../styles/Dashboard.css';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [outlookStatus, setOutlookStatus] = useState(null);
  const [readOnlyMode, setReadOnlyMode] = useState(() => localStorage.getItem('papillon-readonly-mode') === 'true');
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
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      if (parsedUser.role === 'analyst') {
        fetchOutlookStatus();
      } else {
        setReadOnlyMode(false);
        localStorage.setItem('papillon-readonly-mode', 'false');
      }
    }
  }, [navigate]);

  const toggleReadOnlyMode = () => {
    setReadOnlyMode((prev) => {
      const next = !prev;
      localStorage.setItem('papillon-readonly-mode', String(next));
      return next;
    });
  };

  const fetchOutlookStatus = async () => {
    try {
      const response = await getOutlookStatus();
      if (response.data.success) {
        setOutlookStatus(response.data);
      }
    } catch (error) {
      // Analyst users will get 403, which is fine - they can't access Outlook
      // Just log non-403 errors
      if (error.response?.status !== 403) {
        console.error('Error fetching Outlook status:', error);
      }
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

  // Categorized module cards data
  const moduleCategories = [
    {
      category: 'General Tools',
      items: [
        {
          icon: '🔑',
          iconClass: 'red',
          title: 'Password Strength Analysis',
          desc: 'AI-powered password security assessment. Detect your weak passwords.',
          path: '/password-strength'
        },
        {
          icon: '🔐',
          iconClass: 'purple',
          title: 'Text Encryption',
          desc: 'Securely encrypt your text with AES and RSA algorithms.',
          path: '/encryption'
        },
        {
          icon: '🛡️',
          iconClass: 'blue',
          title: 'CVE Vulnerabilities',
          desc: 'Browse the latest CVE vulnerabilities and track security threats.',
          path: '/cve'
        },
        {
          icon: '🗺️',
          iconClass: 'teal',
          title: 'Vulnerability Map',
          desc: 'Visualize system topology and potential vulnerabilities across your infrastructure.',
          path: '/vulnerability-map'
        },
      ]
    },
    {
      category: 'Network Tools',
      items: [
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
        ...(canManageVM() ? [{
          icon: '🖥️',
          iconClass: 'purple',
          title: 'VM Attack Lab',
          desc: 'Start and terminate your attack simulation machine (TryHackMe-style lab skeleton).',
          path: '/vm-lab'
        }] : []),
      ]
    },
    ...(user?.role === 'analyst' ? [{
      category: 'Email & Threats',
      items: [
        {
          icon: '📧',
          iconClass: 'orange',
          title: 'Outlook Integration',
          desc: 'Manage Outlook connection, check status, fetch latest mail and disconnect.',
          path: '/outlook-integration'
        },
        {
          icon: '🎣',
          iconClass: 'orange',
          title: 'Phishing History',
          desc: 'Review historical phishing detections and analyze email threats.',
          path: '/phishing-history'
        },
        {
          icon: '🦠',
          iconClass: 'red',
          title: 'Malware Analysis',
          desc: 'Analyze your files with our AI-powered engine using static/dynamic analysis to detect 0-day threats.',
          path: '/malware-analysis'
        },
      ]
    }] : []),
    {
      category: 'Account & Security',
      items: [
        {
          icon: '👤',
          iconClass: 'teal',
          title: 'Profile & Account',
          desc: 'View your account information, change your password, update domain, and manage MFA.',
          path: '/profile'
        },
        {
          icon: '🚫',
          iconClass: 'purple',
          title: 'IP Blacklist',
          desc: 'Block suspicious IP addresses. IPv4 and IPv6 CIDR format supported.',
          path: '/blacklist'
        },
      ]
    }
  ];

  // Flatten for backwards compatibility
  const moduleCards = moduleCategories.flatMap(cat => cat.items);

  if (!user) {
    return (
      <div className="dashboard-layout">
        <div className="dashboard-main" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: 'var(--auth-text-secondary)', fontSize: '1.1rem' }}>Loading...</div>
        </div>
      </div>
    );
  }

  const isAnalyst = user.role === 'analyst';
  const showReadOnly = isAnalyst && readOnlyMode;

  return (
    <div className={`dashboard-layout ${showReadOnly ? 'read-only-layout' : ''}`}>
      {/* ============ SIDEBAR ============ */}
      {!showReadOnly && <Sidebar user={user} onLogout={handleLogout} />}

      {/* ============ MAIN CONTENT ============ */}
      <main className="dashboard-main">
        {/* Top Bar */}
        <div className="dashboard-topbar">
          <div className="dashboard-greeting">
            <h1>{getGreeting()}, {user.username}! 👋</h1>
            <p>Welcome to your Papillon security dashboard</p>
          </div>
          <div className="topbar-actions">
            {isAnalyst && (
              <button
                className={`topbar-mode-btn ${showReadOnly ? 'active' : ''}`}
                onClick={toggleReadOnlyMode}
                title={showReadOnly ? 'Switch to Interactive Mode' : 'Switch to Read-only Mode'}
              >
                {showReadOnly ? 'Exit Read-only Mode' : 'Switch to Read-only Mode'}
              </button>
            )}
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
          <div className="stat-card teal">
            <div className="stat-card-header">
              <div className="stat-icon">🔑</div>
            </div>
            <div className="stat-value">{user.mfa_enabled ? 'Active' : 'Inactive'}</div>
            <div className="stat-label">MFA Status</div>
          </div>
          {user.role === 'analyst' && (
            <div className="stat-card purple">
              <div className="stat-card-header">
                <div className="stat-icon">📧</div>
              </div>
              <div className="stat-value">{outlookStatus?.is_connected ? 'Connected' : 'Disconnected'}</div>
              <div className="stat-label">Outlook Status</div>
            </div>
          )}
          <div className="stat-card orange">
            <div className="stat-card-header">
              <div className="stat-icon">🌐</div>
            </div>
            <div className="stat-value">{user.domain ? 'Configured' : 'Not Set'}</div>
            <div className="stat-label">Domain Status</div>
          </div>
          <div className="stat-card green">
            <div className="stat-card-header">
              <div className="stat-icon">📊</div>
            </div>
            <div className="stat-value">{user.domain ? 'Active' : 'Inactive'}</div>
            <div className="stat-label">Network Monitoring</div>
          </div>
        </div>

        {!showReadOnly && (
          <>
            {/* Module Cards - Categorized */}
            {moduleCategories.map((section) => (
              <div key={section.category}>
                <h2 style={{ marginTop: '36px', marginBottom: '16px', fontSize: '1.4rem', color: 'var(--auth-text-primary)' }}>
                  {section.category}
                </h2>
                <div className="modules-grid">
                  {section.items.map((mod, i) => (
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
            ))}
          </>
        )}

        {showReadOnly && (
          <div className="dashboard-charts">
            <h2>Read-only Monitoring Overview</h2>
            <div className="charts-grid">
              <div className="chart-card">
                <div className="chart-card-header">
                  <span className="chart-card-title">Network Traffic Graph</span>
                  <span className="chart-card-badge" style={{ background: 'rgba(76, 175, 80, 0.15)', color: '#4caf50' }}>
                    Read-only
                  </span>
                </div>
                <div className="chart-bars">{generateBars(22, 140, 'bar-blue')}</div>
              </div>
              <div className="chart-card">
                <div className="chart-card-header">
                  <span className="chart-card-title">Phishing History Graph</span>
                  <span className="chart-card-badge" style={{ background: 'rgba(255, 152, 0, 0.15)', color: '#ff9800' }}>
                    Read-only
                  </span>
                </div>
                <div className="chart-bars">{generateBars(22, 140, 'bar-teal')}</div>
              </div>
            </div>
          </div>
        )}

        {/* Chart Placeholders */}
        {!showReadOnly && (
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
            {user.role === 'analyst' && (
              <div className="chart-card clickable" onClick={() => navigate('/malware-analysis')} style={{ cursor: 'pointer', transition: 'transform 0.2s' }}>
              <div className="chart-card-header">
                <span className="chart-card-title">Threat Detection (Malware)</span>
                <span className="chart-card-badge" style={{ background: 'rgba(211, 47, 47, 0.15)', color: '#f44336' }}>Comprehensive Analysis</span>
              </div>
              <div className="chart-bars">
                {generateBars(18, 130, 'bar-teal')}
              </div>
              </div>
            )}
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
        )}
      </main>
    </div>
  );
}