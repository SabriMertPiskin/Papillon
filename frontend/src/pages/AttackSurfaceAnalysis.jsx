import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import DashboardLayout from '../components/DashboardLayout';
import { isAdmin } from '../utils/roleUtils';
import { attackSurfaceScan, resolveAnalystDomain } from '../services/api';
import '../styles/AttackSurface.css';

// --- Icons ---
const IconTarget = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <circle cx="12" cy="12" r="6"></circle>
    <circle cx="12" cy="12" r="2"></circle>
  </svg>
);

const IconAlert = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="12" y1="8" x2="12" y2="12"></line>
    <line x1="12" y1="16" x2="12.01" y2="16"></line>
  </svg>
);

const IconDownload = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
    <polyline points="7 10 12 15 17 10"></polyline>
    <line x1="12" y1="15" x2="12" y2="3"></line>
  </svg>
);

const iconsMap = {
  dns: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>,
  subdomain: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>,
  whois: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>,
  ssl: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>,
  port: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line></svg>,
  email: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>,
  admin: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>,
  robot: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>,
  ip: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
};

function AccordionSection({ title, count, icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="accordion-wrapper">
      <button className="accordion-header" onClick={() => setOpen(!open)}>
        <div className="accordion-title-group">
          <div className="accordion-icon">{icon}</div>
          <span className="accordion-title">{title}</span>
          {count !== undefined && count > 0 && (<span className="accordion-badge">{count}</span>)}
        </div>
        <div className="accordion-arrow" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </div>
      </button>
      {open && (<div className="accordion-body">{children}</div>)}
    </div>
  );
}

export default function AttackSurfaceAnalysis() {
  const [domain, setDomain] = useState('');
  const [registeredDomain, setRegisteredDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [selectedAnalyst, setSelectedAnalyst] = useState('');
  const [analystInput, setAnalystInput] = useState('');
  const [selectedAnalystDomain, setSelectedAnalystDomain] = useState('');
  const [selectorLoading, setSelectorLoading] = useState(false);
  const [selectorMessage, setSelectorMessage] = useState({ type: '', text: '' });
  const navigate = useNavigate();

  useEffect(() => {
    const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
    if (!isAuthenticated) { navigate('/login'); }

    const userRaw = localStorage.getItem('user');
    if (userRaw) {
      try {
        const parsedUser = JSON.parse(userRaw);
        const isAdminUser = parsedUser?.role === 'admin';
        const savedDomain = (parsedUser?.domain || '').trim();
        if (!isAdminUser && savedDomain) {
          setRegisteredDomain(savedDomain);
          setDomain(savedDomain);
        }
      } catch (e) {
        // Domain parsing error, allow user to enter manually
      }
    }

    const theme = localStorage.getItem('papillon-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const isAdminUser = isAdmin();
    const targetDomain = isAdminUser ? selectedAnalystDomain.trim() : (registeredDomain || domain).trim();
    if (!targetDomain) { setError('Please enter a domain to start scanning.'); return; }
    if (isAdminUser && !selectedAnalyst.trim()) {
      setError('Please select an analyst first using the arrow button.');
      return;
    }

    setLoading(true); setError(''); setResults(null);
    try {
      const response = await attackSurfaceScan(targetDomain, isAdminUser ? selectedAnalyst : null);
      if (response.data.success) { setResults(response.data.results); }
      else { setError(response.data.detail || 'Scan failed.'); }
    } catch (err) {
      setError(err.response?.data?.detail || 'A server error occurred during the scan.');
    } finally { setLoading(false); }
  };

  const handleApplyAnalyst = async () => {
    const username = analystInput.trim();
    if (!username) {
      setSelectorMessage({ type: 'error', text: 'Please enter an analyst username.' });
      return;
    }

    setSelectorLoading(true);
    setSelectorMessage({ type: '', text: '' });
    setError('');

    try {
      const response = await resolveAnalystDomain(username);
      if (!response.data.success) {
        setSelectorMessage({ type: 'error', text: response.data.detail || 'Could not validate analyst.' });
        setSelectedAnalyst('');
        setSelectedAnalystDomain('');
        return;
      }

      const resolvedUsername = response.data.analyst_username || username;
      const resolvedDomain = response.data.domain || '';
      setSelectedAnalyst(resolvedUsername);
      setSelectedAnalystDomain(resolvedDomain);
      setSelectorMessage({ type: 'success', text: `Analyst selected: ${resolvedUsername} (${resolvedDomain})` });
    } catch (err) {
      setSelectedAnalyst('');
      setSelectedAnalystDomain('');
      setSelectorMessage({ type: 'error', text: err.response?.data?.detail || 'Could not validate analyst.' });
    } finally {
      setSelectorLoading(false);
    }
  };

  const renderValue = (v) => {
    if (v === null || v === undefined) return '—';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  };

  const addSectionTitle = (pdf, title, yPosition, pageHeight) => {
    if (yPosition > pageHeight - 40) { pdf.addPage(); return 20; }
    pdf.setFontSize(12); pdf.setFont(undefined, 'bold'); pdf.text(title, 15, yPosition); pdf.setFont(undefined, 'normal');
    return yPosition + 8;
  };

  const checkPageBreak = (yPosition, pageHeight) => {
    if (yPosition > pageHeight - 30) return { needsBreak: true, newY: 20 };
    return { needsBreak: false, newY: yPosition };
  };

  const exportPDF = () => {
    if (!results) return;
    setExporting(true);
    try {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageHeight = pdf.internal.pageSize.getHeight();
      let yPosition = 20;
      pdf.setFontSize(18); pdf.setFont(undefined, 'bold');
      pdf.text('Attack Surface Analysis Report', 15, yPosition);
      pdf.setFont(undefined, 'normal'); yPosition += 15;

      const basicData = [['Domain', results.domain || '—'], ['IP Address', results.ip || '—'], ['Scan Date', new Date().toLocaleString()]];
      pdf.autoTable({ startY: yPosition, head: [['Info', 'Value']], body: basicData, theme: 'grid', headStyles: { fillColor: [30, 136, 229], textColor: [255, 255, 255], fontStyle: 'bold' }, bodyStyles: { textColor: [40, 40, 40], fontSize: 10 }, alternateRowStyles: { fillColor: [248, 250, 252] }, margin: { left: 15, right: 15 } });
      yPosition = pdf.lastAutoTable.finalY + 12;

      if (results.dns_records && Object.keys(results.dns_records).length > 0) {
        const check = checkPageBreak(yPosition, pageHeight); if (check.needsBreak) { pdf.addPage(); yPosition = check.newY; }
        yPosition = addSectionTitle(pdf, 'DNS Records', yPosition, pageHeight);
        const dnsData = [];
        if (typeof results.dns_records === 'object' && !Array.isArray(results.dns_records)) {
          Object.entries(results.dns_records).forEach(([type, records]) => {
            if (Array.isArray(records)) { records.forEach(record => dnsData.push([type, String(record).substring(0, 70)])); }
            else if (typeof records === 'object') { dnsData.push([type, JSON.stringify(records).substring(0, 70)]); }
            else { dnsData.push([type, String(records).substring(0, 70)]); }
          });
        }
        if (dnsData.length > 0) {
          pdf.autoTable({ startY: yPosition, head: [['Type', 'Value']], body: dnsData, theme: 'grid', headStyles: { fillColor: [50, 50, 50], textColor: [255, 255, 255], fontStyle: 'bold' }, bodyStyles: { textColor: [40, 40, 40], fontSize: 9 }, alternateRowStyles: { fillColor: [248, 250, 252] }, margin: { left: 15, right: 15 } });
          yPosition = pdf.lastAutoTable.finalY + 10;
        }
      }

      if (results.subdomains && Array.isArray(results.subdomains) && results.subdomains.length > 0) {
        const check = checkPageBreak(yPosition, pageHeight); if (check.needsBreak) { pdf.addPage(); yPosition = check.newY; }
        yPosition = addSectionTitle(pdf, 'Detected Subdomains', yPosition, pageHeight);
        const subdomainData = results.subdomains.filter(s => !s.error).map(s => [String(s).substring(0, 90)]);
        if (subdomainData.length > 0) {
          pdf.autoTable({ startY: yPosition, head: [['Subdomain']], body: subdomainData, theme: 'grid', headStyles: { fillColor: [50, 50, 50], textColor: [255, 255, 255], fontStyle: 'bold' }, bodyStyles: { textColor: [40, 40, 40], fontSize: 9 }, alternateRowStyles: { fillColor: [248, 250, 252] }, margin: { left: 15, right: 15 } });
          yPosition = pdf.lastAutoTable.finalY + 10;
        }
      }

      if (results.open_ports && Array.isArray(results.open_ports) && results.open_ports.length > 0) {
        const check = checkPageBreak(yPosition, pageHeight); if (check.needsBreak) { pdf.addPage(); yPosition = check.newY; }
        yPosition = addSectionTitle(pdf, 'Open Ports', yPosition, pageHeight);
        const portData = results.open_ports.filter(p => !p.error).map(p => [String(p.port || '—'), String(p.service || '—')]);
        if (portData.length > 0) {
          pdf.autoTable({ startY: yPosition, head: [['Port', 'Service']], body: portData, theme: 'grid', headStyles: { fillColor: [50, 50, 50], textColor: [255, 255, 255], fontStyle: 'bold' }, bodyStyles: { textColor: [40, 40, 40], fontSize: 9 }, alternateRowStyles: { fillColor: [248, 250, 252] }, margin: { left: 15, right: 15 } });
          yPosition = pdf.lastAutoTable.finalY + 10;
        }
      }

      pdf.save(`AttackSurface_${results.domain}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error('Error exporting PDF:', err);
      alert('PDF export failed: ' + err.message);
    } finally { setExporting(false); }
  };

  const ResultTable = ({ data, columns }) => {
    if (!data || (Array.isArray(data) && data.length === 0)) return null;
    return (
      <div className="results-table-container">
        <table className="results-table">
          <thead><tr>{columns.map((col, idx) => (<th key={idx}>{col}</th>))}</tr></thead>
          <tbody>
            {data.map((row, idx) => (
              <tr key={idx}>
                {row.map((cell, cidx) => {
                  const isError = cell && cell.toString().toLowerCase().includes('error');
                  return (<td key={cidx} className={isError ? 'text-error' : ''}>{renderValue(cell)}</td>);
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="attack-layout">
        <div className="attack-header">
          <div className="header-title-group">
            <div className="header-icon"><IconTarget /></div>
            <div className="header-title">
              <h1>Attack Surface Analysis</h1>
              <p>In-depth surface scanning, port and vulnerability detection for target domains</p>
            </div>
          </div>
        </div>

        <div className="attack-content">
          <div className="scan-card">
            {error && (<div className="alert-error"><IconAlert /> {error}</div>)}
            
            {/* Analyst Selector for Admin */}
            {isAdmin() && (
              <div style={{
                background: 'rgba(63,81,181,0.08)',
                border: '1px solid rgba(63,81,181,0.3)',
                borderRadius: '8px',
                padding: '12px 16px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <label style={{ fontWeight: 600, whiteSpace: 'nowrap', color: 'var(--auth-text-primary)' }}>
                  👤 Monitoring for Analyst:
                </label>
                <input
                  type="text"
                  placeholder="Enter analyst username (e.g., analyst1)"
                  value={analystInput}
                  onChange={(e) => setAnalystInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleApplyAnalyst();
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    border: '1px solid rgba(150,150,150,0.3)',
                    borderRadius: '6px',
                    background: 'var(--auth-input-bg)',
                    color: 'var(--auth-text-primary)',
                    fontSize: '0.9rem'
                  }}
                />
                <button
                  type="button"
                  onClick={handleApplyAnalyst}
                  disabled={selectorLoading}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    border: '1px solid rgba(76, 175, 80, 0.4)',
                    background: 'rgba(76, 175, 80, 0.2)',
                    color: '#81c784',
                    minWidth: '56px'
                  }}
                >
                  {selectorLoading ? '...' : '➜'}
                </button>
              </div>
            )}

            {isAdmin() && selectedAnalyst && (
              <div style={{ marginBottom: '12px', color: 'var(--auth-text-secondary)', fontSize: '0.92rem' }}>
                Using analyst: <strong>{selectedAnalyst}</strong> ({selectedAnalystDomain})
              </div>
            )}

            {isAdmin() && selectorMessage.text && (
              <div style={{ marginBottom: '12px', color: selectorMessage.type === 'error' ? '#ef5350' : '#81c784' }}>
                {selectorMessage.text}
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="scan-form">
              <div className="scan-input-group">
                <label>Domain to Scan</label>
                <input
                  type="text"
                  value={isAdmin() ? (selectedAnalystDomain || '') : (registeredDomain || domain)}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder={isAdmin() ? 'Domain will be fetched after analyst selection' : 'example.com'}
                  disabled={loading || isAdmin()}
                />
              </div>
              <button type="submit" disabled={loading} className="scan-btn">
                {loading ? (<><div className="spinner"></div> Scanning...</>) : (<><span>🔍</span> Start Analysis</>)}
              </button>
            </form>
          </div>

          {results && (
            <div>
              <div className="summary-grid">
                <div className="info-card">
                  <div className="info-icon"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg></div>
                  <div className="info-details">
                    <div className="info-label">Target Domain</div>
                    <div className="info-value" title={results.domain}>{results.domain || '—'}</div>
                  </div>
                </div>
                <div className="info-card">
                  <div className="info-icon"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg></div>
                  <div className="info-details">
                    <div className="info-label">Resolved IP</div>
                    <div className="info-value">{results.ip || '—'}</div>
                  </div>
                </div>
              </div>

              {results.dns_records && results.dns_records.length > 0 && (
                <AccordionSection title="DNS Records" count={results.dns_records.length} icon={iconsMap.dns}>
                  <ResultTable columns={['Record Type', 'Value']} data={results.dns_records.map((record) => { if (record.error) return ['Error', record.error]; if (Array.isArray(record)) return [record[0], record[1]]; return [record, '']; })} />
                </AccordionSection>
              )}
              {results.subdomains && results.subdomains.length > 0 && (
                <AccordionSection title="Detected Subdomains" count={results.subdomains.filter(s => !s?.error).length} icon={iconsMap.subdomain}>
                  <ResultTable columns={['Subdomain Address']} data={results.subdomains.map((sub) => { if (sub && sub.error) return ['Error: ' + sub.error]; return [sub]; })} />
                </AccordionSection>
              )}
              {results.ssl_info && (
                <AccordionSection title="SSL / TLS Certificate" icon={iconsMap.ssl}>
                  <ResultTable columns={['Certificate Property', 'Status']} data={[['Validity Status', results.ssl_info.valid ? 'Valid' : 'Invalid' || 'Error'], ['Details', results.ssl_info.error ? 'Error: ' + results.ssl_info.error : 'Available']]} />
                </AccordionSection>
              )}
              {results.open_ports && results.open_ports.length > 0 && (
                <AccordionSection title="Open Network Ports" count={results.open_ports.filter(p => !p.error).length} icon={iconsMap.port}>
                  <ResultTable columns={['Port Number', 'Service']} data={results.open_ports.map((port) => { if (port.error) return ['Error', port.error]; return [port.port, port.service]; })} />
                </AccordionSection>
              )}
              {results.emails && results.emails.length > 0 && (
                <AccordionSection title="Discovered Email Addresses" count={results.emails.length} icon={iconsMap.email}>
                  <ResultTable columns={['Email Address', 'Detection Source']} data={results.emails.map((email) => { if (email.error) return ['Error', email.error]; return [email.email || email, email.source || '—']; })} />
                </AccordionSection>
              )}
              {results.admin_panels && results.admin_panels.length > 0 && (
                <AccordionSection title="Exposed Admin Panels" count={results.admin_panels.length} icon={iconsMap.admin}>
                  <ResultTable columns={['Panel URL', 'HTTP Status', 'Detection Detail']} data={results.admin_panels.map((panel) => { if (panel.error) return ['Error', panel.error, '']; return [panel.url || panel, panel.status || 'N/A', panel.detail || '']; })} />
                </AccordionSection>
              )}
              {results.whois && results.whois.length > 0 && (
                <AccordionSection title="WHOIS Registration Info" count={results.whois.length} icon={iconsMap.whois}>
                  <ResultTable columns={['Section', 'Value']} data={results.whois.map((item) => { if (item.error) return ['Error', item.error]; if (Array.isArray(item)) return [item[0], item[1]]; return [item, '']; })} />
                </AccordionSection>
              )}
              {results.robots_txt && (
                <AccordionSection title="Robots.txt Scope" icon={iconsMap.robot}>
                  <pre className="code-block">{typeof results.robots_txt === 'string' ? results.robots_txt : 'Error: ' + results.robots_txt}</pre>
                </AccordionSection>
              )}
              {results.ip_info && (
                <AccordionSection title="Device (IP) Information" icon={iconsMap.ip}>
                  <ResultTable columns={['Geography and Provider Summary']} data={[[typeof results.ip_info === 'string' ? results.ip_info : JSON.stringify(results.ip_info, null, 2)]]} />
                </AccordionSection>
              )}
            </div>
          )}

          <div className="action-bar">
            {results && (
              <button onClick={exportPDF} disabled={exporting} className="export-btn">
                <IconDownload />
                {exporting ? 'Generating Report...' : 'Download PDF Report'}
              </button>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}