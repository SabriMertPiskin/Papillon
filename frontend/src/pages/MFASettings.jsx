import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { mfaSetup, mfaVerifySetup, mfaDisable, mfaStatus } from '../services/api';
import '../styles/MFASettings.css';

// SVG Icons
const IconShield = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
  </svg>
);

const IconCheck = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

const IconAlert = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="12" y1="8" x2="12" y2="12"></line>
    <line x1="12" y1="16" x2="12.01" y2="16"></line>
  </svg>
);

const IconKey = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
  </svg>
);

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
    // Theme sync
    const theme = localStorage.getItem('papillon-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    
    fetchMfaStatus();
  }, [navigate]);

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
    setLoading(true);
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
      setMessage({ type: 'error', text: error.response?.data?.detail || 'MFA kurulumu iletişim hatası nedeniyle başlatılamadı.' });
      setStep('idle');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySetup = async (e) => {
    e.preventDefault();
    if (!otpCode || otpCode.length !== 6) {
      setMessage({ type: 'error', text: ' Lütfen 6 haneli doğrulayıcı kodunu eksiksiz girin.' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await mfaVerifySetup(otpCode);
      if (response.data.success) {
        setMfaEnabled(true);
        setSetupData(null);
        setOtpCode('');
        setBackupCode(response.data.backup_code || '');
        setStep('backup');
        setMessage({ type: 'success', text: 'MFA başarıyla yapılandırıldı ve aktifleştirildi.' });
        
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        user.mfa_enabled = true;
        localStorage.setItem('user', JSON.stringify(user));
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.detail || 'Girdiğiniz kod hatalı veya zamanı geçmiş. Lütfen tekrar deneyin.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async (e) => {
    e.preventDefault();
    if (!disablePassword) {
      setMessage({ type: 'error', text: 'İşleme devam etmek için güncel parolanızı girmelisiniz.' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await mfaDisable(disablePassword);
      if (response.data.success) {
        setMfaEnabled(false);
        setDisablePassword('');
        setStep('idle');
        setMessage({ type: 'success', text: 'MFA koruması hesabınızdan kaldırıldı.' });
        
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        user.mfa_enabled = false;
        localStorage.setItem('user', JSON.stringify(user));
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.detail || 'Parola doğrulanamadı. Lütfen kontrol edip tekrar deneyin.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mfa-layout">
      <div className="mfa-card">
        <div className="mfa-header">
          <div className="mfa-title-group">
            <div className="mfa-icon">
              <IconShield />
            </div>
            <div>
              <h2>İki Adımlı Doğrulama (MFA)</h2>
              <div className={`mfa-status-badge ${mfaEnabled ? 'enabled' : 'disabled'}`}>
                {mfaEnabled ? <><IconCheck /> MFA Aktif Koruma</> : <><IconAlert /> MFA Kapalı</>}
              </div>
            </div>
          </div>
          <button className="back-btn" onClick={() => navigate('/dashboard')}>
            ← Panele Dön
          </button>
        </div>

        {message.text && (
          <div className={`mfa-message ${message.type}`}>
            {message.type === 'success' ? <IconCheck /> : <IconAlert />}
            {message.text}
          </div>
        )}

        {loading && step === 'idle' ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--auth-text-muted)' }}>
            Kimlik doğrulama sunucusu ile senkronizasyon sağlanıyor...
          </div>
        ) : (
          <>
            {/* MFA Kapalı — Aktifleştirme */}
            {!mfaEnabled && step === 'idle' && (
              <div className="fade-in">
                <p className="mfa-description">
                  İki adımlı doğrulama (2FA/MFA), şifreniz çalınsa dahi hesabınızı izinsiz erişimlere karşı koruyan hayati bir güvenlik katmanıdır. Eşleşme sonrasında giriş yapabilmeniz için Google Authenticator veya benzeri bir TOTP uygulamasından üretilen dinamik şifreyi girmeniz gerekecektir.
                </p>
                <button className="mfa-btn enable" onClick={handleStartSetup}>
                  <IconKey /> Güvenlik Kurulumunu Başlat
                </button>
              </div>
            )}

            {/* QR Kod + Doğrulama Adımı */}
            {!mfaEnabled && step === 'verify' && setupData && (
              <div className="fade-in">
                <div className="setup-step">
                  <div className="step-number">1</div>
                  <p>Google Authenticator (veya uyumlu bir TOTP uygulaması) yükleyin ve açın.</p>
                </div>
                
                <div className="setup-step">
                  <div className="step-number">2</div>
                  <p>Aşağıdaki QR kodunu tarayarak profilinizi yapılandırın.</p>
                </div>

                <div className="qr-section">
                  <img src={setupData.qr_code} alt="MFA Doğrulama QR Kodu" className="qr-image" />
                  <div className="manual-key">
                    <p>Kameranız okumakta zorlanıyorsa bu gizli anahtarı el ile girebilirsiniz:</p>
                    <code>{setupData.secret}</code>
                  </div>
                </div>

                <div className="setup-step">
                  <div className="step-number">3</div>
                  <p>Eşleşen cihazın ürettiği 6 haneli kodu doğrulama için aşağıya girin.</p>
                </div>

                <form onSubmit={handleVerifySetup}>
                  <div className="otp-input-group">
                    <input
                      type="text"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="······"
                      maxLength={6}
                      className="otp-input"
                      autoFocus
                    />
                    <button type="submit" className="mfa-btn verify" disabled={loading || otpCode.length !== 6}>
                      {loading ? 'Senkronize...' : 'Eşleşmeyi Tamamla'}
                    </button>
                  </div>
                </form>

                <div style={{marginTop: '20px', textAlign: 'center'}}>
                  <button type="button" className="mfa-btn cancel" onClick={() => { setStep('idle'); setSetupData(null); setOtpCode(''); setMessage({type:'', text:''}); }} style={{width: 'auto', display: 'inline-block', padding: '10px 20px', fontSize: '0.9rem'}}>
                    Kurulumu İptal Et
                  </button>
                </div>
              </div>
            )}

            {/* MFA Aktif — Yedek Kod Gösterimi (ilk kurulumdan sonra) */}
            {mfaEnabled && step === 'backup' && backupCode && (
              <div className="backup-code-box fade-in">
                <h3><IconAlert /> Acil Durum Yedek Kodunuz</h3>
                <p style={{ color: '#fbc02d', margin: '0 0 16px 0', fontSize: '0.95rem' }}>
                  Aygıtınıza veya Authenticator uygulamanıza erişiminizi kaybetmeniz halinde hesabınıza giriş yapabilmeniz için tek yol bu koddur. Lütfen bu metni kağıda yazarak güvenli bir kasada saklayın.
                </p>
                <div className="backup-code-display">
                  <code>{backupCode}</code>
                </div>
                <p className="mfa-warning-text" style={{marginTop: '16px'}}>
                  <IconAlert /> Bu kurtarma kodu bir daha EKRANDA GÖSTERİLMEYECEKTİR!
                </p>
                
                <button className="mfa-btn enable" style={{marginTop: '24px'}} onClick={() => { setStep('idle'); setBackupCode(''); }}>
                  Güvenli Yere Kaydettim, Devam Et
                </button>
              </div>
            )}

            {/* MFA Aktif — Devre Dışı Bırakma Menüsü */}
            {mfaEnabled && step === 'idle' && (
              <div className="fade-in">
                <p className="mfa-description">
                  Hesabınız, yetkisiz giriş denemelerine karşı aktif bir TOTP (Time-based One-Time Password) kalkanı ile korunmaktadır. Koruma ayarlarını değiştirmek veya tamamen devre dışı bırakmak için işlemi parolanızla onaylamalısınız.
                </p>
                <button className="mfa-btn disable" onClick={() => setStep('disable')}>
                  MFA Korumasını Devre Dışı Bırak...
                </button>
              </div>
            )}

            {/* Devre Dışı Bırakma Onayı */}
            {mfaEnabled && step === 'disable' && (
              <div className="fade-in">
                <div className="mfa-warning-text">
                  <IconAlert /> DiKKAT: MFA'nın kapatılması yetkisiz girişlere karşı hesabınızda ciddi bir zafiyet doğuracaktır.
                </div>
                
                <form onSubmit={handleDisable}>
                  <div className="form-group">
                    <label>Kimlik Doğrulaması (Hesap Parolanız)</label>
                    <input
                      type="password"
                      value={disablePassword}
                      onChange={(e) => setDisablePassword(e.target.value)}
                      placeholder="Geçerli parolanızı girin..."
                      className="standard-input"
                      autoFocus
                    />
                  </div>
                  
                  <div className="btn-group">
                    <button type="submit" className="mfa-btn disable" disabled={loading || !disablePassword}>
                      {loading ? 'İşleniyor...' : 'Korumayı İptal Et'}
                    </button>
                    <button type="button" className="mfa-btn cancel" onClick={() => { setStep('idle'); setDisablePassword(''); setMessage({type:'', text:''}); }}>
                      Vazgeç
                    </button>
                  </div>
                </form>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
