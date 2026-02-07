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
    setLoadingOutlook(true);
    // Authorize endpoint'ine istek yap
    axios.get('http://localhost:8000/outlook/authorize', {
      withCredentials: true
    })
    .then(response => {
      if (response.data.success) {
        window.location.href = response.data.auth_url;
      }
    })
    .catch(error => {
      console.error('Error:', error);
      setLoadingOutlook(false);
    });
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
                {outlookStatus.is_connected ? '✓ Bağlı' : '✗ Bağlantısız'}
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