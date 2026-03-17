import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { logout } from '../services/api';
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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
      alert('Lütfen Client ID ve Client Secret alanlarını doldurun');
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
      alert('Hata: ' + (error.response?.data?.detail || error.message));
      setLoadingOutlook(false);
    }
  };

  const handleDisconnectOutlook = async () => {
    if (window.confirm('Outlook hesabını bağlantısını kesmek istediğinize emin misiniz?')) {
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
      alert('Mail çekme hatası: ' + (error.response?.data?.detail || 'Bilinmeyen hata'));
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
    if (hour < 6) return 'İyi Geceler';
    if (hour < 12) return 'Günaydın';
    if (hour < 18) return 'İyi Günler';
    return 'İyi Akşamlar';
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

  // Navigation items
  const navItems = [
    {
      section: 'Ana Menü',
      items: [
        { icon: '🏠', label: 'Dashboard', path: '/dashboard', active: true },
      ]
    },
    {
      section: 'Güvenlik Modülleri',
      items: [
        { icon: '🛡️', label: 'CVE Zafiyetleri', path: '/cve' },
        { icon: '🔐', label: 'Şifreleme', path: '/encryption' },
        { icon: '🎯', label: 'Attack Surface', path: '/attack-surface' },
        { icon: '🌐', label: 'Ağ Trafik Analizi', path: '/network-traffic' },
        { icon: '🔑', label: 'Şifre Analizi', path: '/password-strength' },
        { icon: '🚫', label: 'IP Engel Listesi', path: '/blacklist' },
      ]
    },
    {
      section: 'Hesap',
      items: [
        {
          icon: '🛡️',
          label: 'MFA Ayarları',
          path: '/mfa-settings',
          badge: user?.mfa_enabled ? 'Aktif' : 'Pasif',
          badgeClass: user?.mfa_enabled ? 'active' : 'inactive'
        },
        { icon: '👤', label: 'Profil & Hesap', path: '/profile' },
      ]
    }
  ];

  // Module cards data
  const moduleCards = [
    {
      icon: '🛡️',
      iconClass: 'blue',
      title: 'CVE Zafiyetleri',
      desc: 'En güncel CVE zafiyetlerini inceleyin ve güvenlik tehditlerini takip edin.',
      path: '/cve'
    },
    {
      icon: '🔐',
      iconClass: 'purple',
      title: 'Metin Şifreleme',
      desc: 'AES ve RSA algoritmaları ile metinlerinizi güvenli bir şekilde şifreleyin.',
      path: '/encryption'
    },
    {
      icon: '🎯',
      iconClass: 'teal',
      title: 'Attack Surface Analizi',
      desc: 'Hedef domain için port tarama, DNS, SSL, subdomain ve daha fazlası.',
      path: '/attack-surface'
    },
    {
      icon: '🌐',
      iconClass: 'blue',
      title: 'Ağ Trafik Analizi',
      desc: 'Yapay zeka modelleri ile gerçek zamanlı ağ trafiği analizi ve anomali / saldırı tespiti.',
      path: '/network-traffic'
    },
    {
      icon: '🛡️',
      iconClass: 'green',
      title: 'MFA Ayarları',
      desc: 'İki adımlı doğrulamayı yönetin ve hesap güvenliğinizi artırın.',
      path: '/mfa-settings'
    },
    {
      icon: '📧',
      iconClass: 'orange',
      title: 'Outlook Entegrasyonu',
      desc: 'Microsoft Outlook hesabınızı bağlayın ve e-posta analizlerini görüntüleyin.',
      action: () => outlookStatus?.is_connected ? null : handleConnectOutlook(),
      path: outlookStatus?.is_connected ? null : undefined
    },
    {
      icon: '🔑',
      iconClass: 'red',
      title: 'Şifre Güçlülük Analizi',
      desc: 'AI destekli şifre güvenliği değerlendirmesi. Zayıf şifrelerinizi tespit edin.',
      path: '/password-strength'
    },
    {
      icon: '🚫',
      iconClass: 'purple',
      title: 'IP Engel Listesi',
      desc: 'Şüpheli IP adreslerini engelleyin. IPv4 ve IPv6 CIDR formatı desteklenir.',
      path: '/blacklist'
    },
    {
      icon: '👤',
      iconClass: 'teal',
      title: 'Profil & Hesap',
      desc: 'Hesap bilgilerinizi görüntüleyin, şifrenizi değiştirin, domain güncelleyin.',
      path: '/profile'
    },
  ];

  if (!user) {
    return (
      <div className="dashboard-layout">
        <div className="dashboard-main" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: 'var(--auth-text-secondary)', fontSize: '1.1rem' }}>Yükleniyor...</div>
        </div>
      </div>
    );
  }

  const userInitials = user.username
    ? user.username.slice(0, 2).toUpperCase()
    : '?';

  return (
    <div className="dashboard-layout">
      {/* ============ SIDEBAR ============ */}
      <aside className={`dashboard-sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-logo">
          <div className="logo-icon">🦋</div>
          <span className="logo-text">Papillon</span>
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? 'Genişlet' : 'Daralt'}
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
                    className={`sidebar-nav-link ${item.active || location.pathname === item.path ? 'active' : ''}`}
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
              <div className="sidebar-username">{user.username}</div>
              <div className="sidebar-email">{user.email}</div>
            </div>
          </div>
          <button
            className="sidebar-nav-link"
            onClick={handleLogout}
            style={{ color: 'var(--auth-error-text)' }}
          >
            <span className="sidebar-nav-icon">🚪</span>
            <span className="sidebar-nav-label">Çıkış Yap</span>
          </button>
        </div>
      </aside>

      {/* ============ MAIN CONTENT ============ */}
      <main className="dashboard-main">
        {/* Top Bar */}
        <div className="dashboard-topbar">
          <div className="dashboard-greeting">
            <h1>{getGreeting()}, {user.username}! 👋</h1>
            <p>Papillon güvenlik panelinize hoş geldiniz</p>
          </div>
          <div className="topbar-actions">
            <button
              className="topbar-btn"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Aydınlık Mod' : 'Karanlık Mod'}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button
              className="topbar-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              title="Menü"
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
              <span className="stat-trend up">↑ Aktif</span>
            </div>
            <div className="stat-value">9</div>
            <div className="stat-label">Güvenlik Modülü</div>
          </div>
          <div className="stat-card teal">
            <div className="stat-card-header">
              <div className="stat-icon">🔑</div>
            </div>
            <div className="stat-value">{user.mfa_enabled ? 'Aktif' : 'Pasif'}</div>
            <div className="stat-label">MFA Durumu</div>
          </div>
          <div className="stat-card purple">
            <div className="stat-card-header">
              <div className="stat-icon">📧</div>
            </div>
            <div className="stat-value">{outlookStatus?.is_connected ? 'Bağlı' : '—'}</div>
            <div className="stat-label">Outlook Durumu</div>
          </div>
          <div className="stat-card orange">
            <div className="stat-card-header">
              <div className="stat-icon">📅</div>
            </div>
            <div className="stat-value">{new Date(user.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}</div>
            <div className="stat-label">Kayıt Tarihi</div>
          </div>
        </div>

        {/* Module Cards */}
        <div className="dashboard-modules">
          <h2>Güvenlik Modülleri</h2>
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
                    ? <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '6px', background: 'rgba(255,152,0,0.12)', color: '#ff9800' }}>Yakında</span>
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
          <h2>İzleme & Analiz</h2>
          <div className="charts-grid">
            <div className="chart-card clickable" onClick={() => navigate('/network-traffic')} style={{ cursor: 'pointer', transition: 'transform 0.2s', '&:hover': { transform: 'scale(1.02)' } }}>
              <div className="chart-card-header">
                <span className="chart-card-title">Ağ Trafiği Analizi & IDS</span>
                <span style={{ fontSize: '0.8rem', color: '#4caf50', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span className="live-indicator"></span> Canlı Analiz
                </span>
              </div>
              <div className="chart-bars">
                {generateBars(18, 130, 'bar-blue')}
              </div>
            </div>
            <div className="chart-card">
              <div className="chart-card-header">
                <span className="chart-card-title">Tehdit Tespitleri</span>
                <span className="chart-card-badge">Yakında</span>
              </div>
              <div className="chart-bars">
                {generateBars(18, 130, 'bar-teal')}
              </div>
            </div>
            <div className="chart-card">
              <div className="chart-card-header">
                <span className="chart-card-title">Zafiyet Haritası</span>
                <span className="chart-card-badge">Yakında</span>
              </div>
              <div className="chart-placeholder">
                <span className="chart-placeholder-icon">🗺️</span>
                <span className="chart-placeholder-text">Zafiyet haritası verisi bekleniyor</span>
              </div>
            </div>
            <div className="chart-card">
              <div className="chart-card-header">
                <span className="chart-card-title">Phishing Alarm Geçmişi</span>
                <span className="chart-card-badge">Yakında</span>
              </div>
              <div className="chart-placeholder">
                <span className="chart-placeholder-icon">📊</span>
                <span className="chart-placeholder-text">AI modülü entegrasyonu bekleniyor</span>
              </div>
            </div>
          </div>
        </div>

        {/* Outlook Section */}
        <div className="outlook-section">
          <div className="outlook-header">
            <div className="outlook-title">
              📧 Outlook Entegrasyonu
              <span className={`outlook-status-badge ${outlookStatus?.is_connected ? 'connected' : 'disconnected'}`}>
                {outlookStatus?.is_connected ? '● Bağlı' : '○ Bağlantısız'}
              </span>
            </div>
          </div>

          {outlookStatus?.is_connected && outlookStatus.outlook_email && (
            <div className="mail-detail" style={{ marginBottom: '14px' }}>
              Bağlı hesap: <strong>{outlookStatus.outlook_email}</strong>
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
                  {loadingMail ? '⏳ Yükleniyor...' : '📩 Son Maili Göster'}
                </button>
                <button
                  className="outlook-action-btn disconnect"
                  onClick={handleDisconnectOutlook}
                >
                  ✕ Bağlantıyı Kes
                </button>
              </>
            ) : (
              <button
                className="outlook-action-btn connect"
                onClick={handleConnectOutlook}
                disabled={loadingOutlook}
              >
                {loadingOutlook ? '⏳ Yönlendiriliyorsunuz...' : '🔗 Outlook\'u Bağla'}
              </button>
            )}
          </div>

          {latestMail && (
            <div className="latest-mail-card clickable" onClick={() => setShowMailModal(true)} style={{ cursor: 'pointer', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-2px)' } }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ margin: 0 }}>📬 Son Mail</h4>
                <span style={{ fontSize: '0.8rem', color: 'var(--auth-accent)' }}>Tıklayıp Görüntüle →</span>
              </div>
              <div className="mail-detail">
                <strong>Gönderen:</strong> {latestMail.from_name || latestMail.from}
              </div>
              <div className="mail-detail">
                <strong>Konu:</strong> {latestMail.subject || '(Konu yok)'}
              </div>
              <div className="mail-detail">
                <strong>Tarih:</strong> {new Date(latestMail.received_date).toLocaleString('tr-TR')}
              </div>
              <div className="mail-preview">
                <strong>Önizleme:</strong><br />
                {latestMail.preview || 'İçerik yok'}
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
            <h2>Client ID ve Secret Nasıl Alınır?</h2>

            <h4>Adım 1: Azure Portal'a Girin</h4>
            <p>Tarayıcınızda şu adresi açın: <strong>https://portal.azure.com</strong></p>
            <div className="modal-code-block">
              Microsoft hesabınız ile giriş yapın. Eğer hesabınız yoksa, Outlook hesabınızla oturum açabilirsiniz.
            </div>

            <h4>Adım 2: "App registrations" Bulun</h4>
            <ol>
              <li>Azure Portal'da arama çubuğundan <strong>"App registrations"</strong> yazıp arayın</li>
              <li>Sol menüden <strong>"App registrations"</strong> seçeneğine tıklayın</li>
            </ol>

            <h4>Adım 3: Yeni Uygulama Kaydedin</h4>
            <ol>
              <li><strong>"+ New registration"</strong> butonuna tıklayın</li>
              <li><strong>Name:</strong> alanına uygulamanızın adını yazın (örn: "Papillon Mail")</li>
              <li><strong>Supported account types:</strong> kısmında <strong>"Accounts in any organizational directory and personal Microsoft accounts"</strong> seçin</li>
              <li><strong>Redirect URI:</strong> alanında <strong>Web</strong> seçin</li>
              <li>URI'ye şunu yazın: <strong>http://localhost:8000/outlook/callback</strong></li>
              <li><strong>Register</strong> butonuna tıklayın</li>
            </ol>

            <h4>Adım 4: Client ID'yi Kopyalayın</h4>
            <ol>
              <li>Yeni oluşturulan uygulamanın detay sayfasında olacaksınız</li>
              <li><strong>"Application (client) ID"</strong> etiketinin yanındaki kodu kopyalayın</li>
              <li>O kodu <strong>"Client ID"</strong> alanına yapıştırın</li>
            </ol>

            <h4>Adım 5: Client Secret'i Alın</h4>
            <ol>
              <li>Sol menüde <strong>"Certificates & secrets"</strong> tıklayın</li>
              <li><strong>"+ New client secret"</strong> butonuna tıklayın</li>
              <li><strong>Expires</strong> olarak <strong>"24 months"</strong> seçin</li>
              <li><strong>Add</strong> butonuna tıklayın</li>
              <li>Oluşturulan secret'in <strong>"Value"</strong> sütunundaki kodu kopyalayın</li>
              <li><strong>DİKKAT: Bu kodu bir yerde saklayın, tekrar erişilemez!</strong></li>
            </ol>

            <h4>Adım 6: İzinleri Ayarlayın (Opsiyonel)</h4>
            <ol>
              <li>Sol menüde <strong>"API permissions"</strong> tıklayın</li>
              <li><strong>"Mail.Read"</strong> ve <strong>"User.Read"</strong> izinlerini kontrol edin</li>
            </ol>

            <button
              className="modal-btn primary full-width"
              onClick={() => setShowHelpModal(false)}
              style={{ marginTop: '20px' }}
            >
              Anladım, Kapat
            </button>
          </div>
        </div>
      )}

      {/* Mail Detail Modal */}
      {showMailModal && latestMail && (
        <div className="modal-overlay" onClick={() => setShowMailModal(false)}>
          <div className="modal-content wide" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <h2 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.5rem' }}>📧</span> E-posta Detayı
            </h2>
            
            <div style={{ background: 'var(--auth-input-bg, rgba(10, 22, 40, 0.6))', padding: '16px', borderRadius: '12px', marginBottom: '20px', border: '1px solid var(--auth-glass-border)' }}>
              <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <strong>Kimden:</strong> {latestMail.from_name} ({latestMail.from})
              </div>
              <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <strong>Tarih:</strong> {new Date(latestMail.received_date).toLocaleString('tr-TR')}
              </div>
              <div>
                <strong>Konu:</strong> <span style={{ color: 'var(--auth-text-primary)' }}>{latestMail.subject || '(Konu yok)'}</span>
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
              {latestMail.body || latestMail.preview || 'Mail içeriği alınamadı.'}
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                className="modal-btn" 
                onClick={() => {
                  alert("⚠️ AI Phishing Analiz modülü henüz backend tarafında bağlanmadı.");
                  setShowMailModal(false);
                }} 
                style={{ background: 'rgba(244, 67, 54, 0.1)', color: '#ef5350', border: '1px solid rgba(244, 67, 54, 0.3)' }}
              >
                🤖 Yapay Zeka Phishing Taraması Yap
              </button>
              <button className="modal-btn primary" onClick={() => setShowMailModal(false)}>
                Kapat
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
              <h3 style={{ margin: 0 }}>Outlook Bağlantısı</h3>
              <button
                className="topbar-btn"
                onClick={handleShowHelp}
                title="Nasıl alabilirim?"
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
                placeholder="Azure'dan aldığınız Client ID"
              />
            </div>

            <div className="modal-input-group">
              <label>Client Secret *</label>
              <input
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="Azure'dan aldığınız Client Secret"
              />
            </div>

            <div className="modal-actions">
              <button
                className="modal-btn secondary"
                onClick={() => setShowClientIdModal(false)}
                disabled={loadingOutlook}
              >
                İptal
              </button>
              <button
                className="modal-btn primary"
                onClick={handleSaveClientIdAndConnect}
                disabled={loadingOutlook}
              >
                {loadingOutlook ? 'Bağlanıyor...' : 'Bağlan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}