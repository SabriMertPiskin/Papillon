import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, verifyMfa } from '../services/api';
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

    if (!formData.email.includes('@')) newErrors.email = 'Enter a valid email';
    if (!formData.password) newErrors.password = 'Password is required';

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
        setErrors({ submit: response.data.detail || 'Unknown error' });
      }
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Invalid email or password';
      setErrors({ submit: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e) => {
    e.preventDefault();

    if (!otpCode || otpCode.length !== 6) {
      setErrors({ otp: 'Enter the 6-digit code' });
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
        setErrors({ otp: response.data.detail || 'Verification failed' });
      }
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Invalid verification code';
      setErrors({ otp: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  // --- BACKUP CODE SCREEN ---
  if (newBackupCode) {
    return (
      <div className="auth-container">
        <Particles />
        <BrandPanel />
        <div className="auth-form-panel">
          <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
          <div className="auth-box">
            <h2>Your New Backup Code</h2>
            <p className="auth-subtitle">
              A new backup code has been generated because your previous one was used.
              Save this code in a safe place!
            </p>

            <div className="backup-code-box">
              <code>{newBackupCode}</code>
            </div>

            <p className="backup-code-warning">
              ⚠ This code will not be shown again!
            </p>

            <button
              className="backup-continue-btn"
              onClick={() => { window.location.href = '/dashboard'; }}
            >
              Saved, Continue →
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
          <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
          <div className="auth-box">
            <h2>Two-Factor Authentication</h2>
            <p className="auth-subtitle">
              {useBackup
                ? 'Enter the 6-digit backup code you received during MFA setup'
                : 'Enter the 6-digit code from your Google Authenticator app'}
            </p>

            {errors.otp && <div className="error-message">{errors.otp}</div>}

            <form onSubmit={handleMfaSubmit}>
              <div className="form-group">
                <label>{useBackup ? 'Backup Code' : 'Verification Code'}</label>
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
                {loading ? 'Verifying...' : 'Verify'}
              </button>
            </form>

            <div className="auth-divider"><span>or</span></div>

            <p className="toggle-auth">
              <a href="#" onClick={(e) => {
                e.preventDefault();
                setUseBackup(!useBackup);
                setOtpCode('');
                setErrors({});
              }}>
                {useBackup ? '← Use Authenticator code' : 'Use backup code'}
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
                ← Back to login
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
        <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
        <div className="auth-box">
          <h2>Welcome Back</h2>
          <p className="auth-subtitle">
            Sign in to your account to continue
          </p>

          {errors.submit && <div className="error-message">{errors.submit}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="login-email">Email</label>
              <div className="input-wrapper">
                <input
                  id="login-email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="example@email.com"
                  autoComplete="email"
                />
              </div>
              {errors.email && <span className="error">{errors.email}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="login-password">Password</label>
              <div className="input-wrapper">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? 'Hide password' : 'Show password'}
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
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="toggle-auth">
            Don't have an account? <a href="/register">Sign Up</a>
          </p>
        </div>
        <SecurityBadge />
      </div>
    </div>
  );
}