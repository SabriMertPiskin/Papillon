import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import {
  outlookStatus as getOutlookStatus,
  outlookSaveClientId,
  outlookAuthorize,
  outlookDisconnect,
  outlookLatestMail,
  predictPhishing,
} from '../services/api';
import '../styles/OutlookIntegration.css';

export default function OutlookIntegration() {
  const [status, setStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [loadingConnect, setLoadingConnect] = useState(false);
  const [loadingMail, setLoadingMail] = useState(false);
  const [latestMail, setLatestMail] = useState(null);

  const [showClientModal, setShowClientModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showMailModal, setShowMailModal] = useState(false);

  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');

  const [scanLoading, setScanLoading] = useState(false);
  const [scanResult, setScanResult] = useState(null);

  const navigate = useNavigate();

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

    const theme = localStorage.getItem('papillon-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);

    fetchStatus();
  }, [navigate]);

  const fetchStatus = async () => {
    setLoadingStatus(true);
    try {
      const response = await getOutlookStatus();
      if (response.data.success) {
        setStatus(response.data);
      }
    } catch (error) {
      console.error('Outlook status error:', error);
    } finally {
      setLoadingStatus(false);
    }
  };

  const handleConnect = async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      alert('Please fill in both Client ID and Client Secret fields.');
      return;
    }

    setLoadingConnect(true);
    try {
      await outlookSaveClientId(clientId.trim(), clientSecret.trim());
      const authResponse = await outlookAuthorize();
      if (authResponse.data.success && authResponse.data.auth_url) {
        window.location.href = authResponse.data.auth_url;
      }
    } catch (error) {
      alert('Connection error: ' + (error.response?.data?.detail || error.message));
      setLoadingConnect(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect your Outlook account?')) return;

    try {
      await outlookDisconnect();
      setLatestMail(null);
      setScanResult(null);
      await fetchStatus();
    } catch (error) {
      alert('Disconnect error: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleFetchLatestMail = async () => {
    setLoadingMail(true);
    setScanResult(null);
    try {
      const response = await outlookLatestMail();
      if (response.data.success && response.data.email) {
        setLatestMail(response.data.email);
      } else {
        alert(response.data.detail || 'No latest mail found.');
      }
    } catch (error) {
      alert('Mail fetch error: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoadingMail(false);
    }
  };

  const runPhishingScan = async () => {
    if (!latestMail) return;

    setScanLoading(true);
    setScanResult(null);

    try {
      const emailText = latestMail.body || latestMail.preview || '';
      const response = await predictPhishing(emailText, latestMail.from || '', latestMail.subject || '');
      if (response.data.success) {
        setScanResult(response.data.result);
      } else {
        alert('Scan failed: ' + (response.data.detail || 'Unknown error'));
      }
    } catch (error) {
      alert('AI module error: ' + (error.response?.data?.detail || error.message));
    } finally {
      setScanLoading(false);
    }
  };

  const formatDateTime = (value) => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString('tr-TR');
  };

  const getReadableMailBody = (mail) => {
    const rawText = mail?.body || mail?.preview || '';
    if (!rawText) return '';

    return rawText
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<li>/gi, '• ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/\r/g, '')
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter((line, index, arr) => line || arr[index - 1])
      .join('\n')
      .trim();
  };

  const handleRunPhishingScanInline = async (e) => {
    e.stopPropagation();
    await runPhishingScan();
  };

  const readableMailBody = getReadableMailBody(latestMail);
  const previewText = readableMailBody
    ? `${readableMailBody.slice(0, 220)}${readableMailBody.length > 220 ? '...' : ''}`
    : 'Mail preview is not available.';

  return (
    <DashboardLayout>
      <div className="outlook-page">
        <div className="outlook-page-header">
          <div>
            <h1>Outlook Integration</h1>
            <p>Manage connection, check status, fetch latest mail and run AI phishing analysis.</p>
          </div>
          <button className="outlook-nav-btn" onClick={() => navigate('/dashboard')}>← Dashboard</button>
        </div>

        <div className="outlook-status-card">
          <div className="status-title">Connection Status</div>
          {loadingStatus ? (
            <div className="status-loading">Checking status...</div>
          ) : (
            <div className={`status-chip ${status?.is_connected ? 'connected' : 'disconnected'}`}>
              {status?.is_connected ? '● Connected' : '○ Disconnected'}
            </div>
          )}
          {status?.is_connected && status?.outlook_email && (
            <div className="status-email">Connected account: <strong>{status.outlook_email}</strong></div>
          )}
        </div>

        <div className="outlook-actions">
          {!status?.is_connected ? (
            <>
              <button className="outlook-btn connect" onClick={() => setShowClientModal(true)}>🔗 Connect Outlook</button>
              <button className="outlook-btn secondary" onClick={() => setShowHelpModal(true)}>❓ How to get Client ID/Secret</button>
            </>
          ) : (
            <>
              <button className="outlook-btn fetch" onClick={handleFetchLatestMail} disabled={loadingMail}>
                {loadingMail ? '⏳ Loading...' : '📩 Show Latest Mail'}
              </button>
              <button className="outlook-btn warning" onClick={() => navigate('/phishing-history')}>🎣 Phishing History</button>
              <button className="outlook-btn disconnect" onClick={handleDisconnect}>✕ Disconnect</button>
            </>
          )}
        </div>

        {latestMail && (
          <div className="latest-mail-box" onClick={() => setShowMailModal(true)}>
            <div className="latest-mail-title">Latest Mail (click to view details)</div>
            <div className="latest-mail-meta-grid">
              <div className="latest-mail-meta-row">
                <span className="meta-label">From</span>
                <span className="meta-value">{latestMail.from_name || latestMail.from || '-'}</span>
              </div>
              <div className="latest-mail-meta-row">
                <span className="meta-label">Subject</span>
                <span className="meta-value">{latestMail.subject || '(No subject)'}</span>
              </div>
              <div className="latest-mail-meta-row">
                <span className="meta-label">Date</span>
                <span className="meta-value">{formatDateTime(latestMail.received_date)}</span>
              </div>
            </div>
            <div className="latest-mail-preview">
              <span className="meta-label">Preview</span>
              <p>{previewText}</p>
            </div>
            <div className="latest-mail-actions" onClick={(e) => e.stopPropagation()}>
              <button
                className="outlook-btn warning"
                onClick={handleRunPhishingScanInline}
                disabled={scanLoading}
              >
                {scanLoading ? 'Scanning...' : 'Run AI Phishing Scan'}
              </button>
              <button
                className="outlook-btn secondary"
                onClick={() => setShowMailModal(true)}
                disabled={scanLoading}
              >
                Detailed Info
              </button>
            </div>

            {scanResult && (
              <div
                className={`scan-result ${scanResult.status === 'clean' ? 'clean' : 'danger'}`}
                onClick={(e) => e.stopPropagation()}
              >
                <strong>{scanResult.label} — Risk Score: {scanResult.score}/100</strong>
                {scanResult.ai_reasons?.length > 0 && (
                  <ul>
                    {scanResult.ai_reasons.map((reason, idx) => <li key={idx}>{reason}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {showClientModal && (
          <div className="modal-overlay" onClick={() => setShowClientModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3>Connect Outlook</h3>
              <div className="modal-input-group">
                <label>Client ID *</label>
                <input value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="Your Client ID from Azure" />
              </div>
              <div className="modal-input-group">
                <label>Client Secret *</label>
                <input type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} placeholder="Your Client Secret from Azure" />
              </div>
              <div className="modal-actions">
                <button className="modal-btn secondary" onClick={() => setShowClientModal(false)} disabled={loadingConnect}>Cancel</button>
                <button className="modal-btn primary" onClick={handleConnect} disabled={loadingConnect}>
                  {loadingConnect ? 'Connecting...' : 'Connect'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showHelpModal && (
          <div className="modal-overlay" onClick={() => setShowHelpModal(false)}>
            <div className="modal-content wide" onClick={(e) => e.stopPropagation()}>
              <h2>How to Get Client ID and Secret</h2>

              <h4>Step 1: Open Azure Portal</h4>
              <p>Open this address in your browser: <strong>https://portal.azure.com</strong></p>
              <p>
                Sign in with your Microsoft account. If you do not have one, you can sign in with your Outlook account.
              </p>

              <h4>Step 2: Find "App registrations"</h4>
              <ol>
                <li>In Azure Portal, search for <strong>"App registrations"</strong> using the search bar.</li>
                <li>Click <strong>"App registrations"</strong> in the left menu.</li>
              </ol>

              <h4>Step 3: Register a New Application</h4>
              <ol>
                <li>Click <strong>"+ New registration"</strong>.</li>
                <li>Enter your application name in <strong>Name:</strong> (example: "Papillon Mail").</li>
                <li>
                  Under <strong>Supported account types:</strong>, select
                  <strong> "Accounts in any organizational directory (Any Microsoft Entra ID tenant - Multitenant) and personal Microsoft accounts (e.g. Skype, Xbox)"</strong>.
                </li>
                <li>In <strong>Redirect URI:</strong>, select <strong>Web</strong>.</li>
                {/* TODO ileride localhost olmayacak? */}
                <li>Enter this URI: <strong>http://localhost:8000/outlook/callback</strong></li>
                <li>Click <strong>Register</strong>.</li>
              </ol>

              <h4>Step 4: Copy the Client ID</h4>
              <ol>
                <li>You will be on the details page of the newly created app.</li>
                <li>You will see a long code next to <strong>"Application (client) ID"</strong>.</li>
                <li>Copy that code and paste it into the <strong>"Client ID"</strong> field above.</li>
              </ol>

              <h4>Step 5: Generate and Copy the Client Secret</h4>
              <ol>
                <li>Click <strong>"Certificates & secrets"</strong> in the left menu.</li>
                <li>Under <strong>"Client secrets"</strong>, click <strong>"+ New client secret"</strong>.</li>
                <li>In <strong>Description</strong>, you can enter "Mail Access" (optional).</li>
                <li>Select <strong>"24 months"</strong> for <strong>Expires</strong>.</li>
                <li>Click <strong>Add</strong>.</li>
                <li>Copy the long code in the <strong>"Value"</strong> column for the created secret.</li>
                <li><strong>IMPORTANT:</strong> Save this value securely, it will not be shown again.</li>
                <li>Paste that code into the <strong>"Client Secret"</strong> field above.</li>
              </ol>

              <h4>Step 6: Configure Permissions (Optional)</h4>
              <ol>
                <li>Click <strong>"API permissions"</strong> from the left menu.</li>
                <li>Verify that <strong>"Mail.Read"</strong> and <strong>"User.Read"</strong> permissions are present.</li>
              </ol>

              <button className="modal-btn primary full-width" onClick={() => setShowHelpModal(false)}>Close</button>
            </div>
          </div>
        )}

        {showMailModal && latestMail && (
          <div className="modal-overlay" onClick={() => setShowMailModal(false)}>
            <div className="modal-content wide" onClick={(e) => e.stopPropagation()}>
              <h2>Email Details</h2>
              <div className="mail-detail-panel">
                <div className="mail-detail-row">
                  <span className="meta-label">From</span>
                  <span className="meta-value">{latestMail.from_name || '-'} ({latestMail.from || '-'})</span>
                </div>
                <div className="mail-detail-row">
                  <span className="meta-label">Date</span>
                  <span className="meta-value">{formatDateTime(latestMail.received_date)}</span>
                </div>
                <div className="mail-detail-row">
                  <span className="meta-label">Subject</span>
                  <span className="meta-value">{latestMail.subject || '(No subject)'}</span>
                </div>
              </div>

              <div className="mail-content-box">
                <div className="mail-content-title">Message Content</div>
                <div className="mail-content-text">{readableMailBody || 'Could not retrieve mail content.'}</div>
              </div>

              {scanResult && (
                <div className={`scan-result ${scanResult.status === 'clean' ? 'clean' : 'danger'}`}>
                  <strong>{scanResult.label} — Risk Score: {scanResult.score}/100</strong>
                  {scanResult.ai_reasons?.length > 0 && (
                    <ul>
                      {scanResult.ai_reasons.map((reason, idx) => <li key={idx}>{reason}</li>)}
                    </ul>
                  )}
                </div>
              )}

              <div className="modal-actions">
                <button className="modal-btn" onClick={runPhishingScan} disabled={scanLoading}>
                  {scanLoading ? 'Scanning...' : 'Run AI Phishing Scan'}
                </button>
                <button className="modal-btn primary" onClick={() => { setShowMailModal(false); setScanResult(null); }}>Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
