import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import DashboardLayout from '../components/DashboardLayout';
import '../styles/CVEList.css';

// SVG Icons
const IconShieldAlert = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
    <line x1="12" y1="8" x2="12" y2="12"></line>
    <line x1="12" y1="16" x2="12.01" y2="16"></line>
  </svg>
);

const IconLink = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
    <polyline points="15 3 21 3 21 9"></polyline>
    <line x1="10" y1="14" x2="21" y2="3"></line>
  </svg>
);

const IconCalendar = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
    <line x1="16" y1="2" x2="16" y2="6"></line>
    <line x1="8" y1="2" x2="8" y2="6"></line>
    <line x1="3" y1="10" x2="21" y2="10"></line>
  </svg>
);

export default function CVEList() {
  const [cves, setCves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [limit, setLimit] = useState(10);
  const navigate = useNavigate();

  useEffect(() => {
    const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    const theme = localStorage.getItem('papillon-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);

    fetchCVEs();
  }, [navigate, limit]);

  const fetchCVEs = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`http://127.0.0.1:8000/cve/latest/?limit=${limit}`);
      if (response.data.success) {
        setCves(response.data.cves);
      } else {
        setError(response.data.detail);
      }
    } catch (err) {
      setError('An error occurred while fetching CVE data from the server. Please check your connection.');
      console.error('CVE fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityClass = (severity) => {
    if (!severity) return 'severity-unknown';
    switch (severity.toUpperCase()) {
      case 'CRITICAL': return 'severity-critical';
      case 'HIGH': return 'severity-high';
      case 'MEDIUM': return 'severity-medium';
      case 'LOW': return 'severity-low';
      default: return 'severity-unknown';
    }
  };

  return (
    <DashboardLayout>
      <div className="cve-layout">
        {/* Header Area */}
        <div className="cve-header">
          <div className="header-title-group">
            <div className="header-icon">
              <IconShieldAlert />
            </div>
            <div className="header-title">
              <h1>Latest Vulnerabilities (CVE)</h1>
              <p>Most recently published cybersecurity vulnerability reports from the NVD database</p>
            </div>
          </div>
          
          <div className="header-actions">
            <div className="limit-selector">
              <label>Results Per Page:</label>
              <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} disabled={loading}>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
        </div>

        <div className="cve-content">
          {error && (
            <div className="alert-error">
              <IconShieldAlert />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="cve-loading">
              <div className="spinner" style={{width: 30, height: 30, borderWidth: 4}}></div>
              <p>Synchronizing vulnerability database...</p>
            </div>
          ) : (
            <>
              {cves.length === 0 && !error ? (
                <div className="empty-state">
                  <IconShieldAlert />
                  <p>No CVE records found to display at this time.</p>
                </div>
              ) : (
                <div className="cve-grid">
                  {cves.map((cve, index) => {
                    const severityClass = getSeverityClass(cve.severity);
                    return (
                      <div key={index} className={`cve-card ${severityClass}`}>
                        
                        <div className="cve-card-header">
                          <div className="cve-title-wrapper">
                            <h3 className="cve-id">{cve.id}</h3>
                          </div>
                          <span className="severity-badge">
                            {cve.severity || 'UNKNOWN'} {cve.score ? `(${cve.score})` : ''}
                          </span>
                        </div>
                        
                        <p className="cve-description" title={cve.description}>
                          {cve.description}
                        </p>
                        
                        <div className="cve-meta">
                          <div className="cve-date">
                            <IconCalendar />
                            <span>Published: {new Date(cve.published).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                          </div>
                          
                          {cve.references && cve.references.length > 0 && (
                            <div className="cve-references">
                              <strong>External Sources ({cve.references.length})</strong>
                              <ul>
                                {cve.references.slice(0, 3).map((ref, idx) => (
                                  <li key={idx}>
                                    <a href={ref} target="_blank" rel="noopener noreferrer" title={ref}>
                                      <IconLink /> {new URL(ref).hostname || 'Reference Link'}
                                    </a>
                                  </li>
                                ))}
                                {cve.references.length > 3 && (
                                  <li>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--auth-text-muted)', fontStyle: 'italic' }}>
                                      + {cve.references.length - 3} more sources...
                                    </span>
                                  </li>
                                )}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}