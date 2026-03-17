import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, verifyMfa } from '../services/api';
import '../styles/Auth.css';

export default function Login() {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [otpCode, setOtpCode] = useState('');
  const [mfaStep, setMfaStep] = useState(false);
  const [mfaToken, setMfaToken] = useState('');
  const [useBackup, setUseBackup] = useState(false);
  const [newBackupCode, setNewBackupCode] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!formData.email.includes('@')) newErrors.email = 'Geçerli email girin';
    if (!formData.password) newErrors.password = 'Şifre gerekli';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      const response = await login(formData.email, formData.password);

      if (response.data.success && response.data.mfa_required) {
        setMfaToken(response.data.mfa_token);
        setMfaStep(true);
        setErrors({});
      } else if (response.data.success && response.data.user) {
        localStorage.setItem('user', JSON.stringify(response.data.user));
        localStorage.setItem('isAuthenticated', 'true');
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 100);
      } else {
        setErrors({ submit: response.data.detail || 'Bilinmeyen hata' });
      }
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Email veya şifre yanlış';
      setErrors({ submit: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e) => {
    e.preventDefault();

    if (!otpCode || otpCode.length !== 6) {
      setErrors({ otp: '6 haneli kodu girin' });
      return;
    }

    setLoading(true);
    try {
      const response = await verifyMfa(mfaToken, otpCode, useBackup);

      if (response.data.success && response.data.user) {
        if (response.data.new_backup_code) {
          setNewBackupCode(response.data.new_backup_code);
          localStorage.setItem('user', JSON.stringify(response.data.user));
          localStorage.setItem('isAuthenticated', 'true');
          setLoading(false);
          return;
        }

        localStorage.setItem('user', JSON.stringify(response.data.user));
        localStorage.setItem('isAuthenticated', 'true');
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 100);
      } else {
        setErrors({ otp: response.data.detail || 'Doğrulama başarısız' });
      }
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Geçersiz doğrulama kodu';
      setErrors({ otp: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  // Shared components
  const Particles = () => (
    <div className="auth-particles">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="auth-particle" />
      ))}
    </div>
  );

  const BrandPanel = () => (
    <div className="auth-brand-panel">
      <div className="auth-brand-logo">
        <div className="logo-icon">🦋</div>
        <h1>Papillon</h1>
      </div>
      <p className="auth-brand-tagline">
        Siber güvenlik analizlerinizi tek bir platformda yönetin. 
        Gelişmiş tehdit algılama ve güvenlik istihbaratı.
      </p>
      <div className="auth-floating-icons">
        <div className="auth-floating-icon" title="Ağ Güvenliği">🛡️</div>
        <div className="auth-floating-icon" title="Şifreleme">🔐</div>
        <div className="auth-floating-icon" title="Tehdit Analizi">🔍</div>
        <div className="auth-floating-icon" title="Zafiyet Tarama">⚡</div>
        <div className="auth-floating-icon" title="AI Analiz">🤖</div>
      </div>
    </div>
  );

  const ThemeToggle = () => (
    <div className="auth-theme-toggle">
      <button
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Aydınlık Mod' : 'Karanlık Mod'}
        type="button"
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>
    </div>
  );

  const SecurityBadge = () => (
    <div className="auth-footer">
      <div className="auth-security-badge">
        <span className="badge-icon">🔒</span>
        256-bit SSL ile korunmaktadır
      </div>
    </div>
  );

  // --- BACKUP CODE SCREEN ---
  if (newBackupCode) {
    return (
      <div className="auth-container">
        <Particles />
        <BrandPanel />
        <div className="auth-form-panel">
          <ThemeToggle />
          <div className="auth-box">
            <h2>Yeni Yedek Kodunuz</h2>
            <p className="auth-subtitle">
              Yedek kodunuz kullanıldığı için yeni bir kod üretildi.
              Bu kodu güvenli bir yere kaydedin!
            </p>

            <div className="backup-code-box">
              <code>{newBackupCode}</code>
            </div>

            <p className="backup-code-warning">
              ⚠ Bu kod bir daha gösterilmeyecek!
            </p>

            <button
              className="backup-continue-btn"
              onClick={() => { window.location.href = '/dashboard'; }}
            >
              Kaydettim, Devam Et →
            </button>
          </div>
          <SecurityBadge />
        </div>
      </div>
    );
  }

  // --- MFA OTP SCREEN ---
  if (mfaStep) {
    return (
      <div className="auth-container">
        <Particles />
        <BrandPanel />
        <div className="auth-form-panel">
          <ThemeToggle />
          <div className="auth-box">
            <h2>İki Adımlı Doğrulama</h2>
            <p className="auth-subtitle">
              {useBackup
                ? 'MFA kurulumunda aldığınız 6 haneli yedek kodu girin'
                : 'Google Authenticator uygulamasındaki 6 haneli kodu girin'}
            </p>

            {errors.otp && <div className="error-message">{errors.otp}</div>}

            <form onSubmit={handleMfaSubmit}>
              <div className="form-group">
                <label>{useBackup ? 'Yedek Kod' : 'Doğrulama Kodu'}</label>
                <div className="input-wrapper">
                  <span className="input-icon">🔑</span>
                  <input
                    type="text"
                    value={otpCode}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setOtpCode(val);
                      if (errors.otp) setErrors({});
                    }}
                    placeholder="000000"
                    maxLength={6}
                    autoFocus
                    className="otp-input"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || otpCode.length !== 6}
                className={loading ? 'loading' : ''}
              >
                {loading ? 'Doğrulanıyor...' : 'Doğrula'}
              </button>
            </form>

            <div className="auth-divider"><span>veya</span></div>

            <p className="toggle-auth">
              <a href="#" onClick={(e) => {
                e.preventDefault();
                setUseBackup(!useBackup);
                setOtpCode('');
                setErrors({});
              }}>
                {useBackup ? '← Authenticator kodunu kullan' : 'Yedek kodu kullan'}
              </a>
            </p>

            <p className="toggle-auth" style={{ marginTop: '12px' }}>
              <a href="#" onClick={(e) => {
                e.preventDefault();
                setMfaStep(false);
                setOtpCode('');
                setErrors({});
                setUseBackup(false);
              }}>
                ← Giriş ekranına dön
              </a>
            </p>
          </div>
          <SecurityBadge />
        </div>
      </div>
    );
  }

  // --- MAIN LOGIN SCREEN ---
  return (
    <div className="auth-container">
      <Particles />
      <BrandPanel />
      <div className="auth-form-panel">
        <ThemeToggle />
        <div className="auth-box">
          <h2>Hoş Geldiniz</h2>
          <p className="auth-subtitle">
            Devam etmek için hesabınıza giriş yapın
          </p>

          {errors.submit && <div className="error-message">{errors.submit}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="login-email">Email</label>
              <div className="input-wrapper">
                <span className="input-icon">✉️</span>
                <input
                  id="login-email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="ornek@email.com"
                  autoComplete="email"
                />
              </div>
              {errors.email && <span className="error">{errors.email}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="login-password">Şifre</label>
              <div className="input-wrapper">
                <span className="input-icon">🔒</span>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Şifrenizi girin"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
              {errors.password && <span className="error">{errors.password}</span>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className={loading ? 'loading' : ''}
            >
              {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
            </button>
          </form>

          <p className="toggle-auth">
            Hesabın yok mu? <a href="/register">Kayıt Ol</a>
          </p>
        </div>
        <SecurityBadge />
      </div>
    </div>
  );
}