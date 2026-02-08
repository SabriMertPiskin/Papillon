import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { logout } from '../services/api';
import '../styles/Dashboard.css';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [outlookStatus, setOutlookStatus] = useState(null);
  const [loadingOutlook, setLoadingOutlook] = useState(false);
  const [latestMail, setLatestMail] = useState(null);
  const [loadingMail, setLoadingMail] = useState(false);
  const [showClientIdModal, setShowClientIdModal] = useState(false);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [showHelpModal, setShowHelpModal] = useState(false);
  const navigate = useNavigate();
  

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

  if (!user) return <div>Yükleniyor...</div>;

  return (
    <div className="dashboard-container">
      {showHelpModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1001
        }}>
          <div style={{
            background: 'white',
            padding: '30px',
            borderRadius: '8px',
            maxWidth: '700px',
            width: '95%',
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
          }}>
            <h2 style={{ marginTop: 0, color: '#333' }}>Client ID ve Secret Nasıl Alınır?</h2>
            
            <div style={{ lineHeight: '1.8', color: '#555', fontSize: '14px' }}>
              <h4 style={{ color: '#667eea', marginTop: '20px' }}>Adım 1: Azure Portal'a Girin</h4>
              <p>Tarayıcınızda şu adresi açın: <strong>https://portal.azure.com</strong></p>
              <p style={{ background: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
                Microsoft hesabınız ile giriş yapın. Eğer hesabınız yoksa, Outlook hesabınızla oturum açabilirsiniz.
              </p>
              
              <h4 style={{ color: '#667eea', marginTop: '20px' }}>Adım 2: "App registrations" Bulun</h4>
              <ol style={{ paddingLeft: '20px' }}>
                <li>Azure Portal'da arama çubuğundan <strong>"App registrations"</strong> yazıp arayın</li>
                <li>Sol menüden <strong>"App registrations"</strong> seçeneğine tıklayın</li>
              </ol>
              
              <h4 style={{ color: '#667eea', marginTop: '20px' }}>Adım 3: Yeni Uygulama Kaydedin</h4>
              <ol style={{ paddingLeft: '20px' }}>
                <li><strong>"+ New registration"</strong> butonuna tıklayın</li>
                <li><strong>Name:</strong> alanına uygulamanızın adını yazın (örn: "Papillon Mail")</li>
                <li><strong>Supported account types:</strong> kısmında <strong>"Accounts in any organizational directory and personal Microsoft accounts"</strong> seçin</li>
                <li><strong>Redirect URI:</strong> alanında şunu seçin: <strong>Web</strong></li>
                <li>URI'ye şunu yazın: <strong>http://localhost:8000/outlook/callback</strong></li>
                <li><strong>Register</strong> butonuna tıklayın</li>
              </ol>
              
              <h4 style={{ color: '#667eea', marginTop: '20px' }}>Adım 4: Client ID'yi Kopyalayın</h4>
              <ol style={{ paddingLeft: '20px' }}>
                <li>Yeni oluşturulan uygulamanın detay sayfasında olacaksınız</li>
                <li><strong>"Application (client) ID"</strong> etiketinin yanında uzun bir kodu göreceksiniz</li>
                <li>O kodu kopyalayıp yukarıdaki <strong>"Client ID"</strong> alanına yapıştırın</li>
              </ol>
              
              <h4 style={{ color: '#667eea', marginTop: '20px' }}>Adım 5: Client Secret'i Alın</h4>
              <ol style={{ paddingLeft: '20px' }}>
                <li>Sol menüde <strong>"Certificates & secrets"</strong> seçeneğine tıklayın</li>
                <li><strong>"Client secrets"</strong> bölümünde <strong>"+ New client secret"</strong> butonuna tıklayın</li>
                <li><strong>Description</strong> alanına "Mail Access" yazabilirsiniz (opsiyonel)</li>
                <li><strong>Expires</strong> olarak <strong>"24 months"</strong> seçin</li>
                <li><strong>Add</strong> butonuna tıklayın</li>
                <li>Oluşturulan secret'in <strong>"Value"</strong> sütunundaki uzun kodu kopyalayın. </li>
                <li><strong>DİKKAT: Bu kodu bir yerde saklayın, tekrar erişilemez olacaktır.</strong></li>
                <li>O kodu yukarıdaki <strong>"Client Secret"</strong> alanına yapıştırın</li>
              </ol>
              
              <h4 style={{ color: '#667eea', marginTop: '20px' }}>Adım 6: İzinleri Ayarlayın (Opsiyonel)</h4>
              <ol style={{ paddingLeft: '20px' }}>
                <li>Sol menüde <strong>"API permissions"</strong> seçeneğine tıklayın</li>
                <li>İçeride <strong>"Mail.Read"</strong> ve <strong>"User.Read"</strong> izinlerinin olduğunu kontrol edin</li>
              </ol>
              
            </div>
            
            <button
              onClick={() => setShowHelpModal(false)}
              style={{
                marginTop: '20px',
                padding: '10px 20px',
                background: '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
                width: '100%'
              }}
            >
              Anladım, Kapat
            </button>
          </div>
        </div>
      )}
      
      {showClientIdModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: '24px',
            borderRadius: '8px',
            maxWidth: '420px',
            width: '90%',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ marginTop: 0, marginBottom: 0, color: '#333' }}>
                Outlook Bağlantısı
              </h3>
              <button
                onClick={handleShowHelp}
                style={{
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  fontSize: '18px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Nasıl alabilirim?"
              >
                ?
              </button>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '14px' }}>
                Client ID *
              </label>
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="Azure'dan aldığınız Client ID"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '14px' }}>
                Client Secret *
              </label>
              <input
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="Azure'dan aldığınız Client Secret"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowClientIdModal(false)}
                disabled={loadingOutlook}
                style={{
                  padding: '10px 18px',
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                İptal
              </button>
              <button
                onClick={handleSaveClientIdAndConnect}
                disabled={loadingOutlook}
                style={{
                  padding: '10px 18px',
                  background: loadingOutlook ? '#ccc' : '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: loadingOutlook ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
              >
                {loadingOutlook ? 'Bağlanıyor...' : 'Bağlan'}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="dashboard-box">
        <h2>Hoşgeldin, {user.username}!</h2>
        
        <div className="user-info">
          <div className="info-item">
            <strong>Kullanıcı Adı:</strong> {user.username}
          </div>
          <div className="info-item">
            <strong>Email:</strong> {user.email}
          </div>
          {user.domain && (
            <div className="info-item">
              <strong>Domain:</strong> {user.domain}
            </div>
          )}
          <div className="info-item">
            <strong>Kayıt Tarihi:</strong> {new Date(user.created_at).toLocaleDateString('tr-TR')}
          </div>
          
          {outlookStatus && (
            <div className="info-item">
              <strong>Outlook:</strong>
              <span style={{
                marginLeft: '10px',
                padding: '4px 12px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 'bold',
                background: outlookStatus.is_connected ? '#28a745' : '#6c757d',
                color: 'white'
              }}>
                {outlookStatus.is_connected ? 'Bağlı' : 'Bağlantısız'}
              </span>
              {outlookStatus.is_connected && outlookStatus.outlook_email && (
                <div style={{ fontSize: '12px', marginTop: '4px', color: '#666' }}>
                  {outlookStatus.outlook_email}
                </div>
              )}
            </div>
          )}
        </div>

        {latestMail && (
          <div style={{
            background: '#f0f4ff',
            padding: '15px',
            borderRadius: '6px',
            marginBottom: '20px',
            borderLeft: '4px solid #667eea'
          }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#333' }}>Son Mail</h3>
            <div style={{ fontSize: '14px', color: '#555' }}>
              <div style={{ marginBottom: '8px' }}>
                <strong>Gönderen:</strong> {latestMail.from_name || latestMail.from}
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>Konu:</strong> {latestMail.subject || '(Konu yok)'}
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>Tarih:</strong> {new Date(latestMail.received_date).toLocaleString('tr-TR')}
              </div>
              <div style={{ marginTop: '10px', padding: '10px', background: '#fff', borderRadius: '4px', maxHeight: '100px', overflow: 'auto' }}>
                <strong>Önizleme:</strong>
                <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#666' }}>
                  {latestMail.preview || 'İçerik yok'}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="dashboard-actions">
          <a href="/cve" className="action-btn">
            Son CVE Zafiyetlerini Görüntüle
          </a>
          <a href="/encryption" className="action-btn">
            Metin Şifreleme (AES/RSA)
          </a>
          
          {outlookStatus && (
            outlookStatus.is_connected ? (
              <>
                <button className="action-btn outlook-btn" onClick={fetchLatestMail} disabled={loadingMail}>
                  {loadingMail ? 'Yükleniyor...' : 'Son Maili Göster'}
                </button>
                <button className="action-btn disconnect-btn" onClick={handleDisconnectOutlook}>
                  Outlook Bağlantısını Kes
                </button>
              </>
            ) : (
              <button 
                className="action-btn outlook-btn" 
                onClick={handleConnectOutlook}
                disabled={loadingOutlook}
              >
                {loadingOutlook ? 'Yönlendiriliyorsunuz...' : "Outlook'u Bağla"}
              </button>
            )
          )}
          
          <button className="logout-btn" onClick={handleLogout}>
            Çıkış Yap
          </button>
        </div>
      </div>
    </div>
  );
}