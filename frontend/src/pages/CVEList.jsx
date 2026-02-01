import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/CVE.css';

export default function CVEList() {
  const [cves, setCves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    fetchCVEs();
  }, [navigate]);

  const fetchCVEs = async () => {
    try {
      const response = await axios.get('http://127.0.0.1:8000/cve/latest/');
      if (response.data.success) {
        setCves(response.data.cves);
      } else {
        setError(response.data.detail);
      }
    } catch (err) {
      setError('CVE verilerini çekerken hata oluştu');
      console.error('CVE fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityClass = (severity) => {
    switch (severity.toUpperCase()) {
      case 'CRITICAL': return 'severity-critical';
      case 'HIGH': return 'severity-high';
      case 'MEDIUM': return 'severity-medium';
      case 'LOW': return 'severity-low';
      default: return 'severity-unknown';
    }
  };

  if (loading) {
    return (
      <div className="cve-container">
        <div className="loading">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="cve-container">
      <div className="cve-header">
        <h1>Son CVE Zafiyetleri</h1>
        <button onClick={() => navigate('/dashboard')} className="back-btn">
          ← Dashboard'a Dön
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="cve-list">
        {cves.length === 0 ? (
          <p>Henüz CVE verisi yok.</p>
        ) : (
          cves.map((cve, index) => (
            <div key={index} className="cve-card">
              <div className="cve-card-header">
                <h3>{cve.id}</h3>
                <span className={`severity-badge ${getSeverityClass(cve.severity)}`}>
                  {cve.severity} ({cve.score})
                </span>
              </div>
              
              <p className="cve-description">{cve.description}</p>
              
              <div className="cve-footer">
                <span className="published-date">
                  Yayınlanma: {new Date(cve.published).toLocaleDateString('tr-TR')}
                </span>
                
                {cve.references.length > 0 && (
                  <div className="cve-references">
                    <strong>Referanslar:</strong>
                    <ul>
                      {cve.references.map((ref, idx) => (
                        <li key={idx}>
                          <a href={ref} target="_blank" rel="noopener noreferrer">
                            {ref.substring(0, 50)}...
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}