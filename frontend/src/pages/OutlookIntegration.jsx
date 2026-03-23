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
              <h2>Client ID ve Secret Nasıl Alınır?</h2>

              <h4>Adım 1: Azure Portal'a Girin</h4>
              <p>Tarayıcınızda şu adresi açın: <strong>https://portal.azure.com</strong></p>
              <p>
                Microsoft hesabınız ile giriş yapın. Eğer hesabınız yoksa, Outlook hesabınızla oturum açabilirsiniz.
              </p>

              <h4>Adım 2: "App registrations" Bulun</h4>
              <ol>
                <li>Azure Portal'da arama çubuğundan <strong>"App registrations"</strong> yazıp arayın.</li>
                <li>Sol menüden <strong>"App registrations"</strong> seçeneğine tıklayın.</li>
              </ol>

              <h4>Adım 3: Yeni Uygulama Kaydedin</h4>
              <ol>
                <li><strong>"+ New registration"</strong> butonuna tıklayın.</li>
                <li><strong>Name:</strong> alanına uygulamanızın adını yazın (örn: "Papillon Mail").</li>
                <li>
                  <strong>Supported account types:</strong> kısmında
                  <strong> "Accounts in any organizational directory (Any Microsoft Entra ID tenant - Multitenant) and personal Microsoft accounts (e.g. Skype, Xbox)"</strong> seçin.
                </li>
                <li><strong>Redirect URI:</strong> alanında <strong>Web</strong> seçin.</li>
                {/* TODO ileride localhost olmayacak? */}
                <li>URI'ye şunu yazın: <strong>http://localhost:8000/outlook/callback</strong></li>
                <li><strong>Register</strong> butonuna tıklayın.</li>
              </ol>

              <h4>Adım 4: Client ID'yi Kopyalayın</h4>
              <ol>
                <li>Yeni oluşturulan uygulamanın detay sayfasında olacaksınız.</li>
                <li><strong>"Application (client) ID"</strong> etiketinin yanında uzun bir kod göreceksiniz.</li>
                <li>O kodu kopyalayıp yukarıdaki <strong>"Client ID"</strong> alanına yapıştırın.</li>
              </ol>

              <h4>Adım 5: Client Secret'i Alın</h4>
              <ol>
                <li>Sol menüde <strong>"Certificates & secrets"</strong> seçeneğine tıklayın.</li>
                <li><strong>"Client secrets"</strong> bölümünde <strong>"+ New client secret"</strong> butonuna tıklayın.</li>
                <li><strong>Description</strong> alanına "Mail Access" yazabilirsiniz (opsiyonel).</li>
                <li><strong>Expires</strong> olarak <strong>"24 months"</strong> seçin.</li>
                <li><strong>Add</strong> butonuna tıklayın.</li>
                <li>Oluşturulan secret'in <strong>"Value"</strong> sütunundaki uzun kodu kopyalayın.</li>
                <li><strong>DİKKAT:</strong> Bu kodu bir yerde saklayın, tekrar erişilemez olacaktır.</li>
                <li>O kodu yukarıdaki <strong>"Client Secret"</strong> alanına yapıştırın.</li>
              </ol>

              <h4>Adım 6: İzinleri Ayarlayın (Opsiyonel)</h4>
              <ol>
                <li>Sol menüde <strong>"API permissions"</strong> seçeneğine tıklayın.</li>
                <li>İçeride <strong>"Mail.Read"</strong> ve <strong>"User.Read"</strong> izinlerinin olduğunu kontrol edin.</li>
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
                <button className="modal-btn primary" onClick={() => { setShowMailModal(false); setScanResult(null); }}>Kapat</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
