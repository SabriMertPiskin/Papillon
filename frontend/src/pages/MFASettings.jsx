import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { mfaSetup, mfaVerifySetup, mfaDisable, mfaStatus } from '../services/api';
import '../styles/MFASettings.css';

export default function MFASettings() {
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [setupData, setSetupData] = useState(null); // { qr_code, secret }
  const [otpCode, setOtpCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [step, setStep] = useState('idle'); // idle | setup | verify | backup | disable
  const navigate = useNavigate();

  useEffect(() => {
    fetchMfaStatus();
  }, []);

  const fetchMfaStatus = async () => {
    try {
      const response = await mfaStatus();
      if (response.data.success) {
        setMfaEnabled(response.data.mfa_enabled);
      }
    } catch (error) {
      if (error.response?.status === 401) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStartSetup = async () => {
    setMessage({ type: '', text: '' });
    setStep('setup');
    try {
      const response = await mfaSetup();
      if (response.data.success) {
        setSetupData({
          qr_code: response.data.qr_code,
          secret: response.data.secret,
        });
        setStep('verify');
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.detail || 'MFA kurulumu başlatılamadı' });
      setStep('idle');
    }
  };

  const handleVerifySetup = async (e) => {
    e.preventDefault();
    if (!otpCode || otpCode.length !== 6) {
      setMessage({ type: 'error', text: '6 haneli kodu girin' });
      return;
    }

    setLoading(true);
    try {
      const response = await mfaVerifySetup(otpCode);
      if (response.data.success) {
        setMfaEnabled(true);
        setSetupData(null);
        setOtpCode('');
        setBackupCode(response.data.backup_code || '');
        setStep('backup');
        setMessage({ type: 'success', text: 'MFA başarıyla aktifleştirildi!' });
        
        // localStorage'daki user bilgisini güncelle
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        user.mfa_enabled = true;
        localStorage.setItem('user', JSON.stringify(user));
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.detail || 'Doğrulama başarısız' });
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async (e) => {
    e.preventDefault();
    if (!disablePassword) {
      setMessage({ type: 'error', text: 'Şifrenizi girin' });
      return;
    }

    setLoading(true);
    try {
      const response = await mfaDisable(disablePassword);
      if (response.data.success) {
        setMfaEnabled(false);
        setDisablePassword('');
        setStep('idle');
        setMessage({ type: 'success', text: 'MFA devre dışı bırakıldı' });
        
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        user.mfa_enabled = false;
        localStorage.setItem('user', JSON.stringify(user));
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.detail || 'İşlem başarısız' });
    } finally {
      setLoading(false);
    }
  };

  if (loading && step === 'idle') {
    return (
      <div className="mfa-container">
        <div className="mfa-box">
          <p>Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mfa-container">
      <div className="mfa-box">
        <div className="mfa-header">
          <h2>İki Adımlı Doğrulama (MFA)</h2>
          <button className="back-btn" onClick={() => navigate('/dashboard')}>
            ← Dashboard
          </button>
        </div>

        {message.text && (
          <div className={`mfa-message ${message.type}`}>
            {message.text}
          </div>
        )}

        {/* MFA Durum Göstergesi */}
        <div className={`mfa-status-badge ${mfaEnabled ? 'enabled' : 'disabled'}`}>
          {mfaEnabled ? 'MFA Aktif' : 'MFA Kapalı'}
        </div>

        {/* MFA Kapalı — Aktifleştirme */}
        {!mfaEnabled && step === 'idle' && (
          <div className="mfa-section">
            <p className="mfa-description">
              İki adımlı doğrulama, hesabınıza ekstra bir güvenlik katmanı ekler. 
              Giriş yaparken şifrenize ek olarak Google Authenticator'dan bir kod girmeniz gerekir.
            </p>
            <button className="mfa-btn enable" onClick={handleStartSetup}>
              MFA'yı Aktifleştir
            </button>
          </div>
        )}

        {/* QR Kod + Doğrulama Adımı */}
        {!mfaEnabled && step === 'verify' && setupData && (
          <div className="mfa-section">
            <div className="mfa-setup-steps">
              <div className="setup-step">
                <span className="step-number">1</span>
                <p>Google Authenticator uygulamasını telefonunuza indirin</p>
              </div>
              <div className="setup-step">
                <span className="step-number">2</span>
                <p>Aşağıdaki QR kodu uygulama ile tarayın</p>
              </div>
            </div>

            <div className="qr-section">
              <img src={setupData.qr_code} alt="MFA QR Code" className="qr-image" />
              <div className="manual-key">
                <p>QR tarayamıyorsan, bu kodu manuel gir:</p>
                <code>{setupData.secret}</code>
              </div>
            </div>

            <div className="setup-step">
              <span className="step-number">3</span>
              <p>Uygulamadaki 6 haneli kodu aşağıya girin</p>
            </div>

            <form onSubmit={handleVerifySetup}>
              <div className="otp-input-group">
                <input
                  type="text"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  className="otp-input"
                  autoFocus
                />
                <button type="submit" className="mfa-btn verify" disabled={loading || otpCode.length !== 6}>
                  {loading ? 'Doğrulanıyor...' : 'Doğrula ve Aktifleştir'}
                </button>
              </div>
            </form>

            <button className="mfa-btn cancel" onClick={() => { setStep('idle'); setSetupData(null); setOtpCode(''); }}>
              İptal
            </button>
          </div>
        )}

        {/* MFA Aktif — Yedek Kod Gösterimi (ilk kurulumdan sonra) */}
        {mfaEnabled && step === 'backup' && backupCode && (
          <div className="mfa-section">
            <div style={{
              background: '#d4edda',
              border: '2px solid #28a745',
              borderRadius: '8px',
              padding: '20px',
              textAlign: 'center',
              marginBottom: '16px'
            }}>
              <h3 style={{ color: '#155724', margin: '0 0 12px 0' }}>Yedek Kodunuz</h3>
              <p style={{ color: '#155724', fontSize: '14px', marginBottom: '16px' }}>
                Telefonunuza erişemediğinizde bu kodu kullanarak giriş yapabilirsiniz.
                Bu kodu güvenli bir yere kaydedin!
              </p>
              <div style={{
                background: '#fff3cd',
                border: '2px dashed #ffc107',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '12px'
              }}>
                <code style={{
                  fontSize: '28px',
                  fontWeight: 'bold',
                  letterSpacing: '6px',
                  color: '#856404'
                }}>
                  {backupCode}
                </code>
              </div>
              <p style={{ color: '#dc3545', fontSize: '13px', fontWeight: 'bold' }}>
                Bu kod bir daha gösterilmeyecek!
              </p>
            </div>
            <button className="mfa-btn enable" onClick={() => { setStep('idle'); setBackupCode(''); }}>
              Kaydettim, Tamam
            </button>
          </div>
        )}

        {/* MFA Aktif — Devre Dışı Bırakma */}
        {mfaEnabled && step === 'idle' && (
          <div className="mfa-section">
            <p className="mfa-description">
              Hesabınız iki adımlı doğrulama ile korunuyor. 
              Devre dışı bırakmak için şifrenizi doğrulamanız gerekir.
            </p>
            <button className="mfa-btn disable" onClick={() => setStep('disable')}>
              MFA'yı Devre Dışı Bırak
            </button>
          </div>
        )}

        {/* Devre Dışı Bırakma Onayı */}
        {mfaEnabled && step === 'disable' && (
          <div className="mfa-section">
            <p className="mfa-warning">
              MFA'yı kapatmak hesabınızın güvenliğini azaltır.
            </p>
            <form onSubmit={handleDisable}>
              <div className="form-group">
                <label>Şifrenizi doğrulayın</label>
                <input
                  type="password"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  placeholder="Şifreniz"
                  autoFocus
                />
              </div>
              <div className="btn-group">
                <button type="submit" className="mfa-btn disable" disabled={loading}>
                  {loading ? 'İşleniyor...' : 'MFA\'yı Kapat'}
                </button>
                <button type="button" className="mfa-btn cancel" onClick={() => { setStep('idle'); setDisablePassword(''); }}>
                  İptal
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
