import React, { useState } from 'react';
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
  const navigate = useNavigate();

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
        // MFA gerekli — OTP adımına geç
        setMfaToken(response.data.mfa_token);
        setMfaStep(true);
        setErrors({});
      } else if (response.data.success && response.data.user) {
        // MFA yok — direkt giriş
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
        // Yedek kod kullanıldıysa yeni kod göster
        if (response.data.new_backup_code) {
          setNewBackupCode(response.data.new_backup_code);
          localStorage.setItem('user', JSON.stringify(response.data.user));
          localStorage.setItem('isAuthenticated', 'true');
          setLoading(false);
          return; // Yeni kodu göster, sonra devam
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

  // Yedek kod kullanıldıktan sonra yeni kodu göster
  if (newBackupCode) {
    return (
      <div className="auth-container">
        <div className="auth-box">
          <h2>Yeni Yedek Kodunuz</h2>
          <p style={{ textAlign: 'center', color: '#666', marginBottom: '16px' }}>
            Yedek kodunuz kullanıldığı için yeni bir kod üretildi. 
            Bu kodu güvenli bir yere kaydedin!
          </p>
          <div style={{
            background: '#fff3cd',
            border: '2px dashed #ffc107',
            borderRadius: '8px',
            padding: '20px',
            textAlign: 'center',
            marginBottom: '20px'
          }}>
            <code style={{
              fontSize: '28px',
              fontWeight: 'bold',
              letterSpacing: '6px',
              color: '#856404'
            }}>
              {newBackupCode}
            </code>
          </div>
          <p style={{ textAlign: 'center', color: '#dc3545', fontSize: '13px', marginBottom: '16px' }}>
            Bu kod bir daha gösterilmeyecek!
          </p>
          <button
            onClick={() => { window.location.href = '/dashboard'; }}
            style={{
              width: '100%',
              padding: '12px',
              background: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '16px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Kaydettim, Devam Et →
          </button>
        </div>
      </div>
    );
  }

  // MFA OTP Adımı
  if (mfaStep) {
    return (
      <div className="auth-container">
        <div className="auth-box">
          <h2>İki Adımlı Doğrulama</h2>
          <p style={{ textAlign: 'center', color: '#666', marginBottom: '20px' }}>
            {useBackup
              ? 'MFA kurulumunda aldığınız 6 haneli yedek kodu girin'
              : 'Google Authenticator uygulamasındaki 6 haneli kodu girin'}
          </p>
          {errors.otp && <div className="error-message">{errors.otp}</div>}
          
          <form onSubmit={handleMfaSubmit}>
            <div className="form-group">
              <label>{useBackup ? 'Yedek Kod' : 'Doğrulama Kodu'}</label>
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
                style={{ 
                  textAlign: 'center', 
                  fontSize: '24px', 
                  letterSpacing: '8px',
                  fontFamily: 'monospace'
                }}
              />
            </div>

            <button type="submit" disabled={loading || otpCode.length !== 6}>
              {loading ? 'Doğrulanıyor...' : 'Doğrula'}
            </button>
          </form>

          <p className="toggle-auth" style={{ marginTop: '16px' }}>
            <a href="#" onClick={(e) => {
              e.preventDefault();
              setUseBackup(!useBackup);
              setOtpCode('');
              setErrors({});
            }}>
              {useBackup ? '← Authenticator kodunu kullan' : 'Yedek kodu kullan'}
            </a>
          </p>

          <p className="toggle-auth">
            <a href="#" onClick={(e) => { e.preventDefault(); setMfaStep(false); setOtpCode(''); setErrors({}); setUseBackup(false); }}>
              ← Geri Dön
            </a>
          </p>
        </div>
      </div>
    );
  }

  // Normal Login Formu
  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2>Giriş Yap</h2>
        {errors.submit && <div className="error-message">{errors.submit}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Email adresin"
            />
            {errors.email && <span className="error">{errors.email}</span>}
          </div>

          <div className="form-group">
            <label>Şifre</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Şifren"
            />
            {errors.password && <span className="error">{errors.password}</span>}
          </div>

          <button type="submit" disabled={loading}>
            {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>

        <p className="toggle-auth">
          Hesabın yok mu? <a href="/register">Kayıt Ol</a>
        </p>
      </div>
    </div>
  );
}