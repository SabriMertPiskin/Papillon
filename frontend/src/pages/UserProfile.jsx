import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDashboard } from '../services/api';
import API from '../services/api';
import '../styles/UserProfile.css';

const IconUser = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>
  </svg>
);

const IconLock = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
  </svg>
);

const IconGlobe = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
  </svg>
);

const IconShield = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
  </svg>
);

const IconInfo = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>
  </svg>
);

const IconEye = ({ open }) => open ? (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>
  </svg>
) : (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
    <line x1="1" y1="1" x2="23" y2="23"></line>
  </svg>
);

export default function UserProfile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Password change form
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [showPw, setShowPw] = useState({ cur: false, new: false, conf: false });
  const [pwAlert, setPwAlert] = useState(null);
  const [pwLoading, setPwLoading] = useState(false);

  // Domain update
  const [domain, setDomain] = useState('');
  const [domainAlert, setDomainAlert] = useState(null);
  const [domainLoading, setDomainLoading] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
    if (!isAuthenticated) navigate('/login');
    const theme = localStorage.getItem('papillon-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);

    // Try fetching real user data
    setLoading(true);
    getDashboard()
      .then(resp => {
        setUser(resp.data);
        setDomain(resp.data.domain || '');
      })
      .catch(() => {
        // fallback from localStorage
        const stored = localStorage.getItem('user');
        if (stored) {
          const u = JSON.parse(stored);
          setUser(u);
          setDomain(u.domain || '');
        }
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  const showAlert = (setter, msg, type, duration = 3500) => {
    setter({ msg, type });
    setTimeout(() => setter(null), duration);
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (pwForm.new_password !== pwForm.confirm_password) {
      showAlert(setPwAlert, 'Yeni şifreler eşleşmiyor.', 'error');
      return;
    }
    if (pwForm.new_password.length < 8) {
      showAlert(setPwAlert, 'Yeni şifre en az 8 karakter olmalıdır.', 'error');
      return;
    }
    setPwLoading(true);
    try {
      await API.post('/auth/change-password/', {
        current_password: pwForm.current_password,
        new_password: pwForm.new_password,
      });
      setPwForm({ current_password: '', new_password: '', confirm_password: '' });
      showAlert(setPwAlert, 'Şifre başarıyla güncellendi ✓', 'success');
    } catch (err) {
      const msg = err.response?.data?.detail || 'Şifre güncellenemedi. Mevcut şifreyi kontrol edin.';
      showAlert(setPwAlert, msg, 'error');
    } finally {
      setPwLoading(false);
    }
  };

  const handleDomainUpdate = async (e) => {
    e.preventDefault();
    setDomainLoading(true);
    try {
      await API.post('/auth/update-domain/', { domain });
      showAlert(setDomainAlert, 'Domain başarıyla güncellendi ✓', 'success');
    } catch {
      showAlert(setDomainAlert, 'Domain güncellenemedi (backend endpoint hazır değil).', 'error');
    } finally {
      setDomainLoading(false);
    }
  };

  const getInitials = (name) => name ? name.substring(0, 2).toUpperCase() : '??';

  const formatDate = (dt) => {
    if (!dt) return '—';
    try { return new Date(dt).toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' }); }
    catch { return dt; }
  };

  return (
    <div className="profile-layout">
      {/* Header */}
      <div className="profile-header">
        <div className="profile-title-group">
          <div className="profile-header-icon"><IconUser /></div>
          <div>
            <h1>Profil & Hesap Ayarları</h1>
            <p>Hesap bilgilerinizi görüntüleyin ve yönetin</p>
          </div>
        </div>
        <button className="back-btn" onClick={() => navigate('/dashboard')}>← Dashboard'a Dön</button>
      </div>

      {loading ? (
        <div style={{ color: 'var(--auth-text-muted)', padding: 40 }}>Yükleniyor...</div>
      ) : (
        <div className="profile-grid">
          {/* Account Info */}
          <div className="profile-card profile-grid-full">
            <h3><IconInfo /> Hesap Bilgileri</h3>
            {user && (
              <>
                <div className="profile-avatar-block">
                  <div className="profile-avatar">{getInitials(user.username)}</div>
                  <div className="profile-avatar-info">
                    <h2>{user.username}</h2>
                    <p>{user.email}</p>
                  </div>
                </div>
                <div className="profile-info-row">
                  <span className="profile-info-label">Kullanıcı Adı</span>
                  <span className="profile-info-value monospace">{user.username}</span>
                </div>
                <div className="profile-info-row">
                  <span className="profile-info-label">Email</span>
                  <span className="profile-info-value">{user.email}</span>
                </div>
                <div className="profile-info-row">
                  <span className="profile-info-label">Domain</span>
                  <span className="profile-info-value">{user.domain || '—'}</span>
                </div>
                <div className="profile-info-row">
                  <span className="profile-info-label">Kayıt Tarihi</span>
                  <span className="profile-info-value">{formatDate(user.created_at)}</span>
                </div>
                <div className="profile-info-row">
                  <span className="profile-info-label">MFA Durumu</span>
                  <span className={`mfa-status-badge ${user.mfa_enabled ? 'enabled' : 'disabled'}`}>
                    <IconShield />
                    {user.mfa_enabled ? 'Aktif' : 'Kapalı'}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Change Password */}
          <div className="profile-card">
            <h3><IconLock /> Şifre Değiştir</h3>
            {pwAlert && <div className={`profile-alert ${pwAlert.type}`}>{pwAlert.msg}</div>}
            <form onSubmit={handlePasswordChange}>
              <div className="profile-form-group">
                <label>Mevcut Şifre</label>
                <div className="profile-input-wrap">
                  <span className="profile-input-icon"><IconLock /></span>
                  <input
                    className="profile-input"
                    type={showPw.cur ? 'text' : 'password'}
                    placeholder="Mevcut şifrenizi girin"
                    value={pwForm.current_password}
                    onChange={e => setPwForm(p => ({ ...p, current_password: e.target.value }))}
                  />
                  <button type="button" className="profile-eye-btn" onClick={() => setShowPw(p => ({ ...p, cur: !p.cur }))}>
                    <IconEye open={showPw.cur} />
                  </button>
                </div>
              </div>
              <div className="profile-form-group">
                <label>Yeni Şifre</label>
                <div className="profile-input-wrap">
                  <span className="profile-input-icon"><IconLock /></span>
                  <input
                    className="profile-input"
                    type={showPw.new ? 'text' : 'password'}
                    placeholder="Minimum 8 karakter"
                    value={pwForm.new_password}
                    onChange={e => setPwForm(p => ({ ...p, new_password: e.target.value }))}
                  />
                  <button type="button" className="profile-eye-btn" onClick={() => setShowPw(p => ({ ...p, new: !p.new }))}>
                    <IconEye open={showPw.new} />
                  </button>
                </div>
              </div>
              <div className="profile-form-group">
                <label>Yeni Şifre (Tekrar)</label>
                <div className="profile-input-wrap">
                  <span className="profile-input-icon"><IconLock /></span>
                  <input
                    className="profile-input"
                    type={showPw.conf ? 'text' : 'password'}
                    placeholder="Yeni şifreyi tekrar girin"
                    value={pwForm.confirm_password}
                    onChange={e => setPwForm(p => ({ ...p, confirm_password: e.target.value }))}
                  />
                  <button type="button" className="profile-eye-btn" onClick={() => setShowPw(p => ({ ...p, conf: !p.conf }))}>
                    <IconEye open={showPw.conf} />
                  </button>
                </div>
              </div>
              <button type="submit" className="profile-save-btn" disabled={pwLoading}>
                {pwLoading ? 'Güncelleniyor...' : 'Şifreyi Güncelle'}
              </button>
            </form>
          </div>

          {/* Update Domain */}
          <div className="profile-card">
            <h3><IconGlobe /> Domain Güncelle</h3>
            {domainAlert && <div className={`profile-alert ${domainAlert.type}`}>{domainAlert.msg}</div>}
            <form onSubmit={handleDomainUpdate}>
              <div className="profile-form-group">
                <label>Kurumsal Domain</label>
                <div className="profile-input-wrap">
                  <span className="profile-input-icon"><IconGlobe /></span>
                  <input
                    className="profile-input"
                    type="text"
                    placeholder="sirket.com"
                    value={domain}
                    onChange={e => setDomain(e.target.value)}
                  />
                </div>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--auth-text-muted)', margin: '0 0 16px' }}>
                Domain, Attack Surface analizi sırasında varsayılan hedef olarak kullanılır.
              </p>
              <button type="submit" className="profile-save-btn" disabled={domainLoading}>
                {domainLoading ? 'Kaydediliyor...' : 'Domain Kaydet'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
