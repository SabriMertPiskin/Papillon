import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register } from '../services/api';
import '../styles/Auth.css';

const Particles = React.memo(function Particles() {
  return (
    <div className="auth-particles">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="auth-particle" />
      ))}
    </div>
  );
});

const BrandPanel = React.memo(function BrandPanel() {
  return (
    <div className="auth-brand-panel">
      <div className="auth-brand-logo">
        <div className="logo-icon">🦋</div>
        <h1>Papillon</h1>
      </div>
      <p className="auth-brand-tagline">
        Manage your cybersecurity analyses on a single platform.
        Advanced threat detection and security intelligence.
      </p>
      <div className="auth-floating-icons">
        <div className="auth-floating-icon" title="Network Security">🛡️</div>
        <div className="auth-floating-icon" title="Encryption">🔐</div>
        <div className="auth-floating-icon" title="Threat Analysis">🔍</div>
        <div className="auth-floating-icon" title="Vulnerability Scanning">⚡</div>
        <div className="auth-floating-icon" title="AI Analysis">🤖</div>
      </div>
    </div>
  );
});

const ThemeToggle = React.memo(function ThemeToggle({ theme, toggleTheme }) {
  return (
    <div className="auth-theme-toggle">
      <button
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        type="button"
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>
    </div>
  );
});

const SecurityBadge = React.memo(function SecurityBadge() {
  return (
    <div className="auth-footer">
      <div className="auth-security-badge">
        <span className="badge-icon">🔒</span>
        Protected with 256-bit SSL encryption
      </div>
    </div>
  );
});

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
    if (!formData.username.trim()) newErrors.username = 'Username is required';
    else if (formData.username.length < 3) newErrors.username = 'Must be at least 3 characters';
    if (!formData.email.includes('@')) newErrors.email = 'Enter a valid email address';
    if (formData.password.length < 8) newErrors.password = 'Password must be at least 8 characters';
    if (formData.password !== formData.password_confirm)
      newErrors.password_confirm = 'Passwords do not match';
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
      const errorMsg = error.response?.data?.detail || 'An error occurred during registration';
      setErrors({ submit: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <Particles />
      <BrandPanel />

      <div className="auth-form-panel">
        <ThemeToggle theme={theme} toggleTheme={toggleTheme} />

        <div className="auth-box">
          <h2>Create Account</h2>
          <p className="auth-subtitle">Join the Papillon platform</p>

          {errors.submit && <div className="error-message">{errors.submit}</div>}

          <form onSubmit={handleSubmit}>
            {/* Username */}
            <div className="form-group">
              <label>Username</label>
              <div className={`input-wrapper ${errors.username ? 'error' : ''}`}>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="username"
                  autoComplete="username"
                  autoFocus
                />
              </div>
              {errors.username && <span className="field-error-text" style={{color: 'var(--auth-error-text)', fontSize: '0.8rem', marginTop: '4px', display: 'block'}}>{errors.username}</span>}
            </div>

            {/* Email */}
            <div className="form-group">
              <label>Email Address</label>
              <div className={`input-wrapper ${errors.email ? 'error' : ''}`}>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="example@domain.com"
                  autoComplete="email"
                />
              </div>
              {errors.email && <span className="field-error-text" style={{color: 'var(--auth-error-text)', fontSize: '0.8rem', marginTop: '4px', display: 'block'}}>{errors.email}</span>}
            </div>

            {/* Password */}
            <div className="form-group">
              <label>Password</label>
              <div className={`input-wrapper ${errors.password ? 'error' : ''}`}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Minimum 8 characters"
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
              <label>Confirm Password</label>
              <div className={`input-wrapper ${errors.password_confirm ? 'error' : ''}`}>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  name="password_confirm"
                  value={formData.password_confirm}
                  onChange={handleChange}
                  placeholder="Re-enter your password"
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
              <label>Corporate Domain <span style={{fontSize: '0.8em', color: 'var(--auth-text-muted)', fontWeight: 'normal'}}>(optional)</span></label>
              <div className="input-wrapper">
                <input
                  type="text"
                  name="domain"
                  value={formData.domain}
                  onChange={handleChange}
                  placeholder="company.com"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={loading ? 'loading' : ''}
              style={{ marginTop: '10px' }}
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <p className="toggle-auth" style={{ marginTop: '20px' }}>
            Already have an account? <Link to="/login">Sign In</Link>
          </p>
        </div>

        <SecurityBadge />
      </div>
    </div>
  );
}