import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function Sidebar({ user, onLogout }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    {
      section: 'Main Menu',
      items: [
        { icon: '🏠', label: 'Dashboard', path: '/dashboard' },
      ]
    },
    {
      section: 'Security Modules',
      items: [
        { icon: '🛡️', label: 'CVE Vulnerabilities', path: '/cve' },
        { icon: '🔐', label: 'Encryption', path: '/encryption' },
        { icon: '🎯', label: 'Attack Surface', path: '/attack-surface' },
        { icon: '🗺️', label: 'Vulnerability Map', path: '/vulnerability-map' },
        { icon: '🌐', label: 'Network Traffic', path: '/network-traffic' },
        { icon: '🦠', label: 'Malware Analysis', path: '/malware-analysis' },
        { icon: '🔑', label: 'Password Analysis', path: '/password-strength' },
        { icon: '🚫', label: 'IP Blacklist', path: '/blacklist' },
        { icon: '🎣', label: 'Phishing History', path: '/phishing-history' },
      ]
    },
    {
      section: 'Account',
      items: [
        {
          icon: '🛡️',
          label: 'MFA Settings',
          path: '/mfa-settings',
          badge: user?.mfa_enabled ? 'Active' : 'Inactive',
          badgeClass: user?.mfa_enabled ? 'active' : 'inactive'
        },
        { icon: '👤', label: 'Profile & Account', path: '/profile' },
      ]
    }
  ];

  const userInitials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : '?';

  return (
    <aside className={`dashboard-sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${mobileMenuOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-logo">
        <div className="logo-icon">🦋</div>
        <span className="logo-text">Papillon</span>
        <button
          className="sidebar-toggle"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          title={sidebarCollapsed ? 'Expand' : 'Collapse'}
        >
          <span className="toggle-line" />
          <span className="toggle-line" />
          <span className="toggle-line" />
        </button>
      </div>

      {navItems.map((section, si) => (
        <div className="sidebar-section" key={si}>
          <div className="sidebar-section-title">{section.section}</div>
          <ul className="sidebar-nav">
            {section.items.map((item, ii) => (
              <li className="sidebar-nav-item" key={ii}>
                <a
                  href={item.path}
                  className={`sidebar-nav-link ${location.pathname === item.path ? 'active' : ''}`}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(item.path);
                    setMobileMenuOpen(false);
                  }}
                >
                  <span className="sidebar-nav-icon">{item.icon}</span>
                  <span className="sidebar-nav-label">{item.label}</span>
                  {item.badge && (
                    <span className={`sidebar-nav-badge ${item.badgeClass}`}>{item.badge}</span>
                  )}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">{userInitials}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-username">{user?.username}</div>
            <div className="sidebar-email">{user?.email}</div>
          </div>
        </div>
        {onLogout && (
          <button
            className="sidebar-nav-link"
            onClick={onLogout}
            style={{ color: 'var(--auth-error-text)' }}
          >
            <span className="sidebar-nav-icon">🚪</span>
            <span className="sidebar-nav-label">Logout</span>
          </button>
        )}
      </div>
    </aside>
  );
}
