import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import {
  getPhishingHistory,
  outlookStatus,
  outlookLatestMail,
  predictPhishing,
} from '../services/api';
import '../styles/PhishingHistory.css';

export default function PhishingHistory() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedLog, setSelectedLog] = useState(null);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ total_phishing: 0, total_suspicious: 0, total_clean: 0, total_scanned: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [outlookConnected, setOutlookConnected] = useState(false);
  const [outlookEmail, setOutlookEmail] = useState('');
  const [loadingOutlookStatus, setLoadingOutlookStatus] = useState(true);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanMessage, setScanMessage] = useState({ type: '', text: '' });

  // Backend'den veri çek
  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getPhishingHistory(
        filterStatus === 'all' ? '' : filterStatus,
        searchTerm
      );
      if (response.data.success) {
        setLogs(response.data.logs);
        setStats(response.data.stats);
      } else {
        setError(response.data.detail || 'Failed to fetch phishing history');
      }
    } catch (err) {
      if (err.response?.status === 401) {
        setError('Please log in to view phishing history.');
      } else {
        setError('Could not connect to the backend. Make sure the server is running.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Sayfa yüklendiğinde ve filtre değiştiğinde çağır
  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchHistory();
    }, 300);
    return () => clearTimeout(debounce);
  }, [filterStatus, searchTerm]);

  const getStatusLabel = (status) => {
    if (status === 'phishing') return 'PHISHING (DANGER)';
    if (status === 'suspicious') return 'SUSPICIOUS';
    return 'CLEAN (SAFE)';
  };

  const closeModal = () => setSelectedLog(null);

  const fetchOutlookConnectionStatus = async () => {
    setLoadingOutlookStatus(true);
    try {
      const response = await outlookStatus();
      if (response.data.success) {
        setOutlookConnected(Boolean(response.data.is_connected));
        setOutlookEmail(response.data.outlook_email || '');
      }
    } catch (err) {
      setOutlookConnected(false);
      setOutlookEmail('');
    } finally {
      setLoadingOutlookStatus(false);
    }
  };

  const handleScanLatestMail = async () => {
    if (!outlookConnected) {
      setScanMessage({
        type: 'error',
        text: 'Outlook account is not connected. Connect Outlook first to scan latest mail.',
      });
      return;
    }

    setScanLoading(true);
    setScanMessage({ type: '', text: '' });

    try {
      const latestMailResponse = await outlookLatestMail();
      if (!latestMailResponse.data.success || !latestMailResponse.data.email) {
        setScanMessage({
          type: 'error',
          text: latestMailResponse.data.detail || 'No latest mail found to scan.',
        });
        return;
      }

      const latestMail = latestMailResponse.data.email;
      const emailText = (latestMail.body || latestMail.preview || '').trim();

      if (!emailText) {
        setScanMessage({
          type: 'error',
          text: 'Latest email has no readable body/preview to scan.',
        });
        return;
      }

      const scanResponse = await predictPhishing(
        emailText,
        latestMail.from || '',
        latestMail.subject || ''
      );

      if (!scanResponse.data.success) {
        setScanMessage({
          type: 'error',
          text: scanResponse.data.detail || 'Phishing scan failed.',
        });
        return;
      }

      const result = scanResponse.data.result;
      setScanMessage({
        type: 'success',
        text: `Latest mail scanned successfully. Result: ${result.status?.toUpperCase()} (Score: ${result.score}/100).`,
      });

      await fetchHistory();
    } catch (err) {
      setScanMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Could not scan latest mail.',
      });
    } finally {
      setScanLoading(false);
    }
  };

  useEffect(() => {
    const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    if (storedUser.role === 'admin') {
      navigate('/dashboard');
      return;
    }

    fetchOutlookConnectionStatus();
  }, [navigate]);

  return (
    <DashboardLayout>
      <div className="phishing-page-container">
        <div className="phishing-header">
          <div className="phishing-title-section">
            <h1>AI Phishing Alert History</h1>
            <p>Recent email analysis reports scanned and scored by our AI models.</p>
          </div>
          
          <div className="phishing-stats-mini">
            <div className="p-stat-box danger">
              <span className="p-stat-num">{stats.total_phishing}</span>
              <span className="p-stat-lbl">Blocked Phishing</span>
            </div>
            <div className="p-stat-box">
              <span className="p-stat-num">{stats.total_suspicious}</span>
              <span className="p-stat-lbl">Suspicious Detected</span>
            </div>
            <div className="p-stat-box safe">
              <span className="p-stat-num">{stats.total_clean}</span>
              <span className="p-stat-lbl">Clean Emails</span>
            </div>
          </div>
        </div>

        <div className="phishing-actions-card">
          <div className="phishing-actions-left">
            <h3>Quick Scan</h3>
            {loadingOutlookStatus ? (
              <p className="phishing-action-note">Checking Outlook connection...</p>
            ) : outlookConnected ? (
              <p className="phishing-action-note success">
                Outlook connected{outlookEmail ? `: ${outlookEmail}` : ''}
              </p>
            ) : (
              <p className="phishing-action-note warning">
                Outlook disconnected. You can still review history below.
              </p>
            )}
          </div>

          <button
            className="scan-latest-btn"
            onClick={handleScanLatestMail}
            disabled={!outlookConnected || scanLoading || loadingOutlookStatus}
          >
            {scanLoading ? 'Scanning latest mail...' : 'Scan Latest Mail'}
          </button>
        </div>

        {scanMessage.text && (
          <div className={`scan-feedback ${scanMessage.type}`}>
            {scanMessage.type === 'success' ? '✅' : '⚠️'} {scanMessage.text}
          </div>
        )}

        <div className="phishing-filters">
          <input 
            type="text" 
            className="filter-input" 
            placeholder="Search by sender or subject..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select 
            className="filter-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All Scans</option>
            <option value="phishing">Critical Only (Phishing)</option>
            <option value="suspicious">Suspicious Only</option>
            <option value="clean">Safe Only</option>
          </select>
        </div>

        <div className="phishing-grid">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '50px', color: 'var(--auth-text-muted)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '10px' }}>⏳</div>
              Loading scan history...
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '50px', color: '#ef5350' }}>
              <div style={{ fontSize: '2rem', marginBottom: '10px' }}>⚠️</div>
              {error}
            </div>
          ) : logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px', color: 'var(--auth-text-muted)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '10px' }}>📭</div>
              {searchTerm || filterStatus !== 'all' 
                ? 'No logs matching the search criteria.' 
                : 'No phishing scans yet. Use the Dashboard to scan emails with AI.'}
            </div>
          ) : (
            logs.map(log => (
              <div 
                key={log.id} 
                className={`phishing-card status-${log.status}`}
                onClick={() => setSelectedLog(log)}
              >
                <div className="p-card-score">
                  <span className="p-score-val">{log.score}</span>
                  <span className="p-score-lbl">Risk Score</span>
                </div>
                
                <div className="p-card-content">
                  <div className="p-card-header">
                    <h3 className="p-subject">{log.subject || '(No Subject)'}</h3>
                    <span className={`p-badge ${log.status}`}>{getStatusLabel(log.status)}</span>
                  </div>
                  <div className="p-sender">{log.sender || '(Unknown Sender)'}</div>
                  <div className="p-preview">{log.preview}</div>
                </div>

                <div className="p-card-meta">
                  <span className="p-date">{log.date}</span>
                  <button className="p-action-btn">View Analysis →</button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Detail Modal */}
        {selectedLog && (
          <div className="modal-overlay" onClick={closeModal}>
            <div className="modal-content wide" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px' }}>
              <div className="phishing-modal-header">
                <h2>
                  <span style={{ fontSize: '1.8rem' }}>{selectedLog.status === 'clean' ? '✅' : '🚨'}</span>
                  AI Phishing Report
                </h2>
                <span className={`p-badge ${selectedLog.status}`}>{getStatusLabel(selectedLog.status)} - Risk Score: {selectedLog.score}/100</span>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '8px', border: '1px solid var(--auth-glass-border)' }}>
                <div style={{ marginBottom: '10px' }}><strong>Date:</strong> {selectedLog.date}</div>
                <div style={{ marginBottom: '10px' }}><strong>Sender:</strong> <span style={{ color: '#64b5f6', fontFamily: 'monospace' }}>{selectedLog.sender}</span></div>
                <div><strong>Subject:</strong> {selectedLog.subject}</div>
              </div>

              <div className={`ai-reasoning-box ${selectedLog.status === 'clean' ? 'safe' : ''}`}>
                <h4>🤖 AI Decision Rationale (Explainable AI)</h4>
                <ul className="ai-reasoning-list">
                  {(selectedLog.aiReasons || []).map((reason, idx) => (
                    <li key={idx} style={{ marginBottom: '8px' }}>{reason}</li>
                  ))}
                </ul>
              </div>

              <div style={{ marginTop: '20px' }}>
                <h4 style={{ marginBottom: '10px', color: 'var(--auth-text-secondary)' }}>Email Raw Content (Body)</h4>
                <div style={{ 
                  background: 'var(--auth-input-bg)', 
                  padding: '15px', 
                  borderRadius: '8px', 
                  fontFamily: 'monospace',
                  fontSize: '0.9rem',
                  whiteSpace: 'pre-wrap',
                  border: '1px solid var(--auth-input-border)',
                  maxHeight: '200px',
                  overflowY: 'auto'
                }}>
                  {selectedLog.fullBody}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '15px', justifyContent: 'flex-end', marginTop: '30px' }}>
                <button className="modal-btn primary" onClick={closeModal}>Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
