import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
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

// Menu Icons
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

// Accordion (Premium UI)
function AccordionSection({ title, count, icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="accordion-wrapper">
      <button className="accordion-header" onClick={() => setOpen(!open)}>
        <div className="accordion-title-group">
          <div className="accordion-icon">{icon}</div>
          <span className="accordion-title">{title}</span>
          {count !== undefined && count > 0 && (
            <span className="accordion-badge">{count}</span>
          )}
        </div>
        <div className="accordion-arrow" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </button>
      {open && (
        <div className="accordion-body">
          {children}
        </div>
      )}
    </div>
  );
}

export default function AttackSurfaceAnalysis() {
  const [domain, setDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
    if (!isAuthenticated) {
      navigate('/login');
    }
    
    // Theme sync
    const theme = localStorage.getItem('papillon-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!domain.trim()) {
      setError('Lütfen tarama için bir domain girin.');
      return;
    }

    setLoading(true);
    setError('');
    setResults(null);

    try {
      const response = await axios.post('http://localhost:8000/attack-surface/scan/', {
        domain: domain.trim()
      }, {
        withCredentials: true
      });

      if (response.data.success) {
        setResults(response.data.results);
      } else {
        setError(response.data.detail || 'Tarama başarısız oldu.');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Tarama sırasında sunucu hatası oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const renderValue = (v) => {
    if (v === null || v === undefined) return '—';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  };

  // --- PDF Export Logic with Turkish Character Support ---
  const setTurkishFont = (pdf, style = 'normal') => {
    // Use Courier font which has better Unicode support for Turkish characters
    pdf.setFont('courier', style);
  };

  const addSectionTitle = (pdf, title, yPosition, pageHeight) => {
    if (yPosition > pageHeight - 40) {
      pdf.addPage();
      return 20;
    }
    pdf.setFontSize(12);
    setTurkishFont(pdf, 'bold');
    pdf.text(title, 15, yPosition);
    setTurkishFont(pdf, 'normal');
    return yPosition + 8;
  };

  const checkPageBreak = (yPosition, pageHeight) => {
    if (yPosition > pageHeight - 30) {
      return { needsBreak: true, newY: 20 };
    }
    return { needsBreak: false, newY: yPosition };
  };

  const exportPDF = () => {
    if (!results) return;

    setExporting(true);
    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageHeight = pdf.internal.pageSize.getHeight();
      let yPosition = 20;

      // Title
      pdf.setFontSize(18);
      setTurkishFont(pdf, 'bold');
      pdf.text('Attack Surface Analysis Report', 15, yPosition);
      setTurkishFont(pdf, 'normal');
      yPosition += 15;

      // Basic Info - Domain and IP
      const basicData = [
        ['Domain', results.domain || '—'],
        ['IP Address', results.ip || '—'],
        ['Scan Date', new Date().toLocaleString()]
      ];
      
      pdf.autoTable({
        startY: yPosition,
        head: [['Information', 'Value']],
        body: basicData,
        theme: 'grid',
        headStyles: { fillColor: [30, 136, 229], textColor: [255, 255, 255], fontStyle: 'bold', font: 'courier' },
        bodyStyles: { textColor: [40, 40, 40], fontSize: 10, font: 'courier' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 15, right: 15 },
        didDrawPage: (data) => {
          yPosition = pdf.lastAutoTable.finalY + 12;
        }
      });
      yPosition = pdf.lastAutoTable.finalY + 12;

      // DNS Records
      if (results.dns_records && Object.keys(results.dns_records).length > 0) {
        const check = checkPageBreak(yPosition, pageHeight);
        if (check.needsBreak) { pdf.addPage(); yPosition = check.newY; }
        yPosition = addSectionTitle(pdf, 'DNS Records', yPosition, pageHeight);
        
        const dnsData = [];
        if (typeof results.dns_records === 'object' && !Array.isArray(results.dns_records)) {
          Object.entries(results.dns_records).forEach(([type, records]) => {
            if (Array.isArray(records)) {
              records.forEach(record => dnsData.push([type, String(record).substring(0, 70)]));
            } else if (typeof records === 'object') {
              dnsData.push([type, JSON.stringify(records).substring(0, 70)]);
            } else {
              dnsData.push([type, String(records).substring(0, 70)]);
            }
          });
        }
        if (dnsData.length > 0) {
          pdf.autoTable({
            startY: yPosition, head: [['Type', 'Value']], body: dnsData, theme: 'grid',
            headStyles: { fillColor: [50, 50, 50], textColor: [255, 255, 255], fontStyle: 'bold', font: 'courier' },
            bodyStyles: { textColor: [40, 40, 40], fontSize: 9, font: 'courier' }, alternateRowStyles: { fillColor: [248, 250, 252] },
            margin: { left: 15, right: 15 }, columnStyles: { 1: { cellWidth: 'auto' } }
          });
          yPosition = pdf.lastAutoTable.finalY + 10;
        }
      }

      // Subdomains
      if (results.subdomains && Array.isArray(results.subdomains) && results.subdomains.length > 0) {
        const check = checkPageBreak(yPosition, pageHeight);
        if (check.needsBreak) { pdf.addPage(); yPosition = check.newY; }
        yPosition = addSectionTitle(pdf, 'Discovered Subdomains', yPosition, pageHeight);
        const subdomainData = results.subdomains.filter(s => !s.error).map(s => {
          const subdomain = typeof s === 'object' ? (s.subdomain || JSON.stringify(s).substring(0, 80)) : String(s).substring(0, 90);
          return [String(subdomain).substring(0, 90)];
        });
        if (subdomainData.length > 0) {
          pdf.autoTable({
            startY: yPosition, head: [['Subdomain']], body: subdomainData, theme: 'grid',
            headStyles: { fillColor: [50, 50, 50], textColor: [255, 255, 255], fontStyle: 'bold', font: 'courier' },
            bodyStyles: { textColor: [40, 40, 40], fontSize: 9, font: 'courier' }, alternateRowStyles: { fillColor: [248, 250, 252] }, margin: { left: 15, right: 15 }
          });
          yPosition = pdf.lastAutoTable.finalY + 10;
        }
      }

      // Open Ports - Only create table if there's actual port data
      const validPorts = results.open_ports?.filter(p => p && !p.error && p.port) || [];
      if (validPorts.length > 0) {
        const check = checkPageBreak(yPosition, pageHeight);
        if (check.needsBreak) { pdf.addPage(); yPosition = check.newY; }
        yPosition = addSectionTitle(pdf, 'Open Ports', yPosition, pageHeight);
        const portData = validPorts.map(p => [String(p.port || '—'), String(p.service || '—')]);
        pdf.autoTable({
          startY: yPosition, head: [['Port', 'Service']], body: portData, theme: 'grid',
          headStyles: { fillColor: [50, 50, 50], textColor: [255, 255, 255], fontStyle: 'bold', font: 'courier' },
          bodyStyles: { textColor: [40, 40, 40], fontSize: 9, font: 'courier' }, alternateRowStyles: { fillColor: [248, 250, 252] }, margin: { left: 15, right: 15 }
        });
        yPosition = pdf.lastAutoTable.finalY + 10;
      }

      // SSL Certificate
      if (results.ssl_info && typeof results.ssl_info === 'object' && !results.ssl_info.error) {
        const check = checkPageBreak(yPosition, pageHeight);
        if (check.needsBreak) { pdf.addPage(); yPosition = check.newY; }
        yPosition = addSectionTitle(pdf, 'SSL/TLS Certificate', yPosition, pageHeight);
        const sslData = [];
        if (results.ssl_info.data) {
          if (typeof results.ssl_info.data === 'object') {
            Object.entries(results.ssl_info.data).forEach(([key, value]) => {
              let displayValue = '—';
              if (typeof value === 'object' && value !== null) {
                displayValue = JSON.stringify(value).substring(0, 70);
              } else if (value !== null && value !== undefined) {
                displayValue = String(value).substring(0, 70);
              }
              sslData.push([String(key), displayValue]);
            });
          } else {
            sslData.push(['Info', String(results.ssl_info.data).substring(0, 70)]);
          }
        }
        if (results.ssl_info.valid !== undefined) sslData.push(['Valid', results.ssl_info.valid ? 'Yes' : 'No']);
        
        if (sslData.length > 0) {
          pdf.autoTable({
            startY: yPosition, head: [['Property', 'Value']], body: sslData, theme: 'grid',
            headStyles: { fillColor: [50, 50, 50], textColor: [255, 255, 255], fontStyle: 'bold', font: 'courier' },
            bodyStyles: { textColor: [40, 40, 40], fontSize: 9, font: 'courier' }, alternateRowStyles: { fillColor: [248, 250, 252] }, margin: { left: 15, right: 15 }
          });
          yPosition = pdf.lastAutoTable.finalY + 10;
        }
      }

      // Emails
      if (results.emails && Array.isArray(results.emails) && results.emails.length > 0) {
        const check = checkPageBreak(yPosition, pageHeight);
        if (check.needsBreak) { pdf.addPage(); yPosition = check.newY; }
        yPosition = addSectionTitle(pdf, 'Discovered Email Addresses', yPosition, pageHeight);
        const emailData = results.emails.filter(e => !e.error).map(e => {
          const email = typeof e === 'object' ? (e.email || JSON.stringify(e).substring(0, 80)) : String(e).substring(0, 90);
          return [String(email).substring(0, 90)];
        });
        if (emailData.length > 0) {
          pdf.autoTable({
            startY: yPosition, head: [['Email Address']], body: emailData, theme: 'grid',
            headStyles: { fillColor: [50, 50, 50], textColor: [255, 255, 255], fontStyle: 'bold', font: 'courier' },
            bodyStyles: { textColor: [40, 40, 40], fontSize: 9, font: 'courier' }, alternateRowStyles: { fillColor: [248, 250, 252] }, margin: { left: 15, right: 15 }
          });
          yPosition = pdf.lastAutoTable.finalY + 10;
        }
      }

      // Admin Panels
      if (results.admin_panels && Array.isArray(results.admin_panels) && results.admin_panels.length > 0) {
        const check = checkPageBreak(yPosition, pageHeight);
        if (check.needsBreak) { pdf.addPage(); yPosition = check.newY; }
        yPosition = addSectionTitle(pdf, 'Admin Panels', yPosition, pageHeight);
        const adminData = results.admin_panels.filter(a => !a.error).map(a => {
          const url = typeof a === 'object' ? (a.url || a.panel || JSON.stringify(a).substring(0, 80)) : String(a).substring(0, 90);
          return [String(url).substring(0, 90)];
        });
        if (adminData.length > 0) {
          pdf.autoTable({
            startY: yPosition, head: [['URL']], body: adminData, theme: 'grid',
            headStyles: { fillColor: [50, 50, 50], textColor: [255, 255, 255], fontStyle: 'bold', font: 'courier' },
            bodyStyles: { textColor: [40, 40, 40], fontSize: 9, font: 'courier' }, alternateRowStyles: { fillColor: [248, 250, 252] }, margin: { left: 15, right: 15 }
          });
          yPosition = pdf.lastAutoTable.finalY + 10;
        }
      }

      // WHOIS Info
      if (results.whois && Array.isArray(results.whois) && results.whois.length > 0) {
        const check = checkPageBreak(yPosition, pageHeight);
        if (check.needsBreak) { pdf.addPage(); yPosition = check.newY; }
        yPosition = addSectionTitle(pdf, 'WHOIS Information', yPosition, pageHeight);
        const whoisData = results.whois.filter(w => !w.error).map(w => {
          let whoisText;
          if (typeof w === 'object' && w !== null) {
            whoisText = JSON.stringify(w).substring(0, 80);
          } else {
            whoisText = String(w).substring(0, 90);
          }
          return [whoisText];
        });
        if (whoisData.length > 0) {
          pdf.autoTable({
            startY: yPosition, head: [['Information']], body: whoisData, theme: 'grid',
            headStyles: { fillColor: [50, 50, 50], textColor: [255, 255, 255], fontStyle: 'bold', font: 'courier' },
            bodyStyles: { textColor: [40, 40, 40], fontSize: 9, font: 'courier' }, alternateRowStyles: { fillColor: [248, 250, 252] }, margin: { left: 15, right: 15 }
          });
          yPosition = pdf.lastAutoTable.finalY + 10;
        }
      }

      // IP Info
      if (results.ip_info && typeof results.ip_info === 'object' && !results.ip_info.error) {
        const check = checkPageBreak(yPosition, pageHeight);
        if (check.needsBreak) { pdf.addPage(); yPosition = check.newY; }
        yPosition = addSectionTitle(pdf, 'IP Information', yPosition, pageHeight);
        const ipData = [];
        Object.entries(results.ip_info).forEach(([key, value]) => {
          let displayValue = '—';
          if (typeof value === 'object' && value !== null) {
            displayValue = JSON.stringify(value).substring(0, 70);
          } else if (value !== null && value !== undefined) {
            displayValue = String(value).substring(0, 70);
          }
          ipData.push([String(key), displayValue]);
        });
        if (ipData.length > 0) {
          pdf.autoTable({
            startY: yPosition, head: [['Property', 'Value']], body: ipData, theme: 'grid',
            headStyles: { fillColor: [50, 50, 50], textColor: [255, 255, 255], fontStyle: 'bold', font: 'courier' },
            bodyStyles: { textColor: [40, 40, 40], fontSize: 9, font: 'courier' }, alternateRowStyles: { fillColor: [248, 250, 252] }, margin: { left: 15, right: 15 }
          });
        }
      }

      pdf.save(`AttackSurface_${results.domain}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error('Error exporting PDF:', err);
      alert('PDF export failed: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  const ResultTable = ({ data, columns }) => {
    if (!data || (Array.isArray(data) && data.length === 0)) return null;

    return (
      <div className="results-table-container">
        <table className="results-table">
          <thead>
            <tr>
              {columns.map((col, idx) => (
                <th key={idx}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr key={idx}>
                {row.map((cell, cidx) => {
                  const isError = cell && cell.toString().toLowerCase().includes('hata');
                  return (
                    <td key={cidx} className={isError ? 'text-error' : ''}>
                      {renderValue(cell)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="attack-layout">
      {/* Header */}
      <div className="attack-header">
        <div className="header-title-group">
          <div className="header-icon">
            <IconTarget />
          </div>
          <div className="header-title">
            <h1>Attack Surface Analizi</h1>
            <p>Hedef domain için derinlemesine yüzey taraması, port ve zafiyet tespiti</p>
          </div>
        </div>
      </div>

      <div className="attack-content">
        {/* Search / Scan Box */}
        <div className="scan-card">
          {error && (
            <div className="alert-error">
              <IconAlert /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="scan-form">
            <div className="scan-input-group">
              <label>Hedef Domain / IP Adresi</label>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="Örn: github.com"
                disabled={loading}
              />
            </div>
            <button type="submit" disabled={loading} className="scan-btn">
              {loading ? (
                <>
                  <div className="spinner"></div> Taranıyor...
                </>
              ) : (
                <>
                  <span>🔍</span> Analizi Başlat
                </>
              )}
            </button>
          </form>
        </div>

        {/* Results Area */}
        {results && (
          <div>
            {/* Top Info Cards */}
            <div className="summary-grid">
              <div className="info-card">
                <div className="info-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                </div>
                <div className="info-details">
                  <div className="info-label">Domain Hedefi</div>
                  <div className="info-value" title={results.domain}>{results.domain || '—'}</div>
                </div>
              </div>
              <div className="info-card">
                <div className="info-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                </div>
                <div className="info-details">
                  <div className="info-label">Çözümlenen IP</div>
                  <div className="info-value">{results.ip || '—'}</div>
                </div>
              </div>
            </div>

            {/* Detailed Accordions */}
            {results.dns_records && results.dns_records.length > 0 && (
              <AccordionSection title="DNS Kayıtları" count={results.dns_records.length} icon={iconsMap.dns}>
                <ResultTable
                  columns={['Kayıt Türü', 'Değer']}
                  data={results.dns_records.map((record) => {
                    if (record.error) return ['Hata', record.error];
                    if (Array.isArray(record)) return [record[0], record[1]];
                    return [record, ''];
                  })}
                />
              </AccordionSection>
            )}

            {results.subdomains && results.subdomains.length > 0 && (
              <AccordionSection title="Tespit Edilen Subdomainler" count={results.subdomains.filter(s => !s?.error).length} icon={iconsMap.subdomain}>
                <ResultTable
                  columns={['Subdomain Adresi']}
                  data={results.subdomains.map((sub) => {
                    if (sub && sub.error) return ['Hata: ' + sub.error];
                    return [sub];
                  })}
                />
              </AccordionSection>
            )}

            {results.ssl_info && (
              <AccordionSection title="SSL / TLS Sertifikası" icon={iconsMap.ssl}>
                <ResultTable
                  columns={['Sertifika Özelliği', 'Durum']}
                  data={[
                    ['Geçerlilik Durumu', results.ssl_info.valid ? 'Geçerli' : 'Geçersiz' || 'Hata'],
                    ['Detaylar', results.ssl_info.error ? 'Hata: ' + results.ssl_info.error : 'Mevcut']
                  ]}
                />
              </AccordionSection>
            )}

            {results.open_ports && results.open_ports.length > 0 && (
              <AccordionSection title="Açık Ağ Portları" count={results.open_ports.filter(p => !p.error).length} icon={iconsMap.port}>
                <ResultTable
                  columns={['Port Numarası', 'Temsil Eden Servis']}
                  data={results.open_ports.map((port) => {
                    if (port.error) return ['Hata', port.error];
                    return [port.port, port.service];
                  })}
                />
              </AccordionSection>
            )}

            {results.emails && results.emails.length > 0 && (
              <AccordionSection title="Bulunan E-posta Adresleri" count={results.emails.length} icon={iconsMap.email}>
                <ResultTable
                  columns={['Maskelenmemiş E-posta', 'Sızıntı / Tespit Kaynağı']}
                  data={results.emails.map((email) => {
                    if (email.error) return ['Hata', email.error];
                    return [email.email || email, email.source || '—'];
                  })}
                />
              </AccordionSection>
            )}

            {results.admin_panels && results.admin_panels.length > 0 && (
              <AccordionSection title="Açık Yönetim Panelleri" count={results.admin_panels.length} icon={iconsMap.admin}>
                <ResultTable
                  columns={['Panel URL', 'HTTP Durumu', 'Tespit Detayı']}
                  data={results.admin_panels.map((panel) => {
                    if (panel.error) return ['Hata', panel.error, ''];
                    return [panel.url || panel, panel.status || 'N/A', panel.detail || ''];
                  })}
                />
              </AccordionSection>
            )}

            {results.whois && results.whois.length > 0 && (
              <AccordionSection title="WHOIS Tescil Bilgileri" count={results.whois.length} icon={iconsMap.whois}>
                <ResultTable
                  columns={['Bölüm', 'Değer']}
                  data={results.whois.map((item) => {
                    if (item.error) return ['Hata', item.error];
                    if (Array.isArray(item)) return [item[0], item[1]];
                    return [item, ''];
                  })}
                />
              </AccordionSection>
            )}

            {results.robots_txt && (
              <AccordionSection title="Robots.txt Kapsamı" icon={iconsMap.robot}>
                <pre className="code-block">
                  {typeof results.robots_txt === 'string' ? results.robots_txt : 'Hata: ' + results.robots_txt}
                </pre>
              </AccordionSection>
            )}

            {results.ip_info && (
              <AccordionSection title="Cihaz (IP) Bilgileri" icon={iconsMap.ip}>
                <ResultTable
                  columns={['Coğrafya ve Sağlayıcı Özeti']}
                  data={[[typeof results.ip_info === 'string' ? results.ip_info : JSON.stringify(results.ip_info, null, 2)]]}
                />
              </AccordionSection>
            )}
          </div>
        )}

        <div className="action-bar">
          <button onClick={() => navigate('/dashboard')} className="back-btn" style={{marginBottom: 0, padding: '14px 24px'}}>
            Dashboard'a Dön
          </button>
          
          {results && (
            <button
              onClick={exportPDF}
              disabled={exporting}
              className="export-btn"
            >
              <IconDownload />
              {exporting ? 'Rapor Oluşturuluyor...' : 'PDF Raporu İndir'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}