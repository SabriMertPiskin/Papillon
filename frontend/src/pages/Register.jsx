import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register } from '../services/api';
import '../styles/Auth.css';

export default function Register() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    password_confirm: '',
    domain: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('papillon-theme');
    if (saved) document.documentElement.setAttribute('data-theme', saved);
    return saved || 'dark';
  });
  const navigate = useNavigate();

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('papillon-theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.username.trim()) newErrors.username = 'Kullanıcı adı zorunludur';
    else if (formData.username.length < 3) newErrors.username = 'En az 3 karakter olmalıdır';
    if (!formData.email.includes('@')) newErrors.email = 'Geçerli bir email adresi girin';
    if (formData.password.length < 8) newErrors.password = 'Şifre en az 8 karakter olmalıdır';
    if (formData.password !== formData.password_confirm)
      newErrors.password_confirm = 'Şifreler eşleşmiyor';
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = validateForm();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      await register(formData.username, formData.email, formData.password, formData.domain);
      navigate('/login', { state: { registered: true } });
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Kayıt sırasında bir hata oluştu';
      setErrors({ submit: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  // Shared components to match Login exactly
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

  return (
    <div className="auth-container">
      <Particles />
      <BrandPanel />

      <div className="auth-form-panel">
        <ThemeToggle />

        <div className="auth-box">
          <h2>Hesap Oluştur</h2>
          <p className="auth-subtitle">Papillon platformuna katılın</p>

          {errors.submit && <div className="error-message">{errors.submit}</div>}

          <form onSubmit={handleSubmit}>
            {/* Username */}
            <div className="form-group">
              <label>Kullanıcı Adı</label>
              <div className={`input-wrapper ${errors.username ? 'error' : ''}`}>
                <span className="input-icon">👤</span>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="kullaniciadi"
                  autoComplete="username"
                  autoFocus
                />
              </div>
              {errors.username && <span className="field-error-text" style={{color: 'var(--auth-error-text)', fontSize: '0.8rem', marginTop: '4px', display: 'block'}}>{errors.username}</span>}
            </div>

            {/* Email */}
            <div className="form-group">
              <label>Email Adresi</label>
              <div className={`input-wrapper ${errors.email ? 'error' : ''}`}>
                <span className="input-icon">✉️</span>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="ornek@domain.com"
                  autoComplete="email"
                />
              </div>
              {errors.email && <span className="field-error-text" style={{color: 'var(--auth-error-text)', fontSize: '0.8rem', marginTop: '4px', display: 'block'}}>{errors.email}</span>}
            </div>

            {/* Password */}
            <div className="form-group">
              <label>Şifre</label>
              <div className={`input-wrapper ${errors.password ? 'error' : ''}`}>
                <span className="input-icon">🔑</span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Minimum 8 karakter"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex="-1"
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
              {errors.password && <span className="field-error-text" style={{color: 'var(--auth-error-text)', fontSize: '0.8rem', marginTop: '4px', display: 'block'}}>{errors.password}</span>}
            </div>

            {/* Confirm Password */}
            <div className="form-group">
              <label>Şifre Tekrar</label>
              <div className={`input-wrapper ${errors.password_confirm ? 'error' : ''}`}>
                <span className="input-icon">🔑</span>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  name="password_confirm"
                  value={formData.password_confirm}
                  onChange={handleChange}
                  placeholder="Şifrenizi tekrar girin"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirm(!showConfirm)}
                  tabIndex="-1"
                >
                  {showConfirm ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
              {errors.password_confirm && <span className="field-error-text" style={{color: 'var(--auth-error-text)', fontSize: '0.8rem', marginTop: '4px', display: 'block'}}>{errors.password_confirm}</span>}
            </div>

            {/* Domain */}
            <div className="form-group">
              <label>Kurumsal Domain <span style={{fontSize: '0.8em', color: 'var(--auth-text-muted)', fontWeight: 'normal'}}>(isteğe bağlı)</span></label>
              <div className="input-wrapper">
                <span className="input-icon">🌐</span>
                <input
                  type="text"
                  name="domain"
                  value={formData.domain}
                  onChange={handleChange}
                  placeholder="sirket.com"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={loading ? 'loading' : ''}
              style={{ marginTop: '10px' }}
            >
              {loading ? 'Hesap Oluşturuluyor...' : 'Hesap Oluştur'}
            </button>
          </form>

          <p className="toggle-auth" style={{ marginTop: '20px' }}>
            Zaten hesabın var mı? <Link to="/login">Giriş Yap</Link>
          </p>
        </div>

        <SecurityBadge />
      </div>
    </div>
  );
}