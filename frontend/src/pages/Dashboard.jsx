import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout } from '../services/api';
import '../styles/Dashboard.css';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      navigate('/login');
    } else {
      setUser(JSON.parse(userData));
    }
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await logout();
      localStorage.removeItem('user');
      localStorage.removeItem('isAuthenticated');
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
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
        </div>

        <div className="dashboard-actions">
          <a href="/cve" className="action-btn">
            Son CVE Zafiyetlerini Görüntüle
          </a>
          <a href="/encryption" className="action-btn">
            Metin Şifreleme (AES/RSA)
          </a>
          <button className="logout-btn" onClick={handleLogout}>
            Çıkış Yap
          </button>
        </div>
      </div>
    </div>
  );
}