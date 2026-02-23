import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import '../styles/Dashboard.css';

export default function AttackSurfaceAnalysis() {
  const [domain, setDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!domain.trim()) {
      setError('Lütfen bir domain girin');
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
        setError(response.data.detail || 'Tarama başarısız');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Tarama sırasında hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const renderValue = (v) => {
    if (v === null || v === undefined) return '—';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  };

  const addSectionTitle = (pdf, title, yPosition, pageHeight) => {
    if (yPosition > pageHeight - 40) {
      pdf.addPage();
      return 20;
    }
    pdf.setFontSize(12);
    pdf.setFont(undefined, 'bold');
    pdf.text(title, 15, yPosition);
    pdf.setFont(undefined, 'normal');
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
      pdf.setFont(undefined, 'bold');
      pdf.text('Saldırı Yüzeyi Analiz Raporu', 15, yPosition);
      pdf.setFont(undefined, 'normal');
      yPosition += 15;

      // Basic Info - Domain and IP
      const basicData = [
        ['Domain', results.domain || '—'],
        ['IP Adresi', results.ip || '—'],
        ['Tarama Tarihi', new Date().toLocaleString()]
      ];
      
      pdf.autoTable({
        startY: yPosition,
        head: [['Bilgi', 'Değer']],
        body: basicData,
        theme: 'grid',
        headStyles: { fillColor: [30, 30, 30], textColor: [255, 255, 255], fontStyle: 'bold' },
        bodyStyles: { textColor: [0, 0, 0], fontSize: 10 },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        margin: { left: 15, right: 15 },
        didDrawPage: (data) => {
          yPosition = pdf.lastAutoTable.finalY + 12;
        }
      });
      yPosition = pdf.lastAutoTable.finalY + 12;

      // DNS Records
      if (results.dns_records && Object.keys(results.dns_records).length > 0) {
        const check = checkPageBreak(yPosition, pageHeight);
        if (check.needsBreak) {
          pdf.addPage();
          yPosition = check.newY;
        }
        
        yPosition = addSectionTitle(pdf, 'DNS Kayıtları', yPosition, pageHeight);
        
        const dnsData = [];
        if (typeof results.dns_records === 'object' && !Array.isArray(results.dns_records)) {
          Object.entries(results.dns_records).forEach(([type, records]) => {
            if (Array.isArray(records)) {
              records.forEach(record => {
                dnsData.push([type, String(record).substring(0, 60)]);
              });
            } else if (typeof records === 'object') {
              dnsData.push([type, JSON.stringify(records).substring(0, 60)]);
            } else {
              dnsData.push([type, String(records).substring(0, 60)]);
            }
          });
        }

        if (dnsData.length > 0) {
          pdf.autoTable({
            startY: yPosition,
            head: [['Türü', 'Değer']],
            body: dnsData,
            theme: 'grid',
            headStyles: { fillColor: [50, 50, 50], textColor: [255, 255, 255], fontStyle: 'bold' },
            bodyStyles: { textColor: [0, 0, 0], fontSize: 9 },
            alternateRowStyles: { fillColor: [245, 245, 245] },
            margin: { left: 15, right: 15 },
            columnStyles: { 1: { cellWidth: 'auto' } }
          });
          yPosition = pdf.lastAutoTable.finalY + 10;
        }
      }

      // Subdomains
      if (results.subdomains && Array.isArray(results.subdomains) && results.subdomains.length > 0) {
        const check = checkPageBreak(yPosition, pageHeight);
        if (check.needsBreak) {
          pdf.addPage();
          yPosition = check.newY;
        }

        yPosition = addSectionTitle(pdf, 'Tespit Edilen Alt Etki Alanları', yPosition, pageHeight);

        const subdomainData = results.subdomains
          .filter(s => !s.error)
          .map(subdomain => [String(subdomain).substring(0, 80)]);

        if (subdomainData.length > 0) {
          pdf.autoTable({
            startY: yPosition,
            head: [['Alt Etki Alanı']],
            body: subdomainData,
            theme: 'grid',
            headStyles: { fillColor: [50, 50, 50], textColor: [255, 255, 255], fontStyle: 'bold' },
            bodyStyles: { textColor: [0, 0, 0], fontSize: 9 },
            alternateRowStyles: { fillColor: [245, 245, 245] },
            margin: { left: 15, right: 15 }
          });
          yPosition = pdf.lastAutoTable.finalY + 10;
        }
      }

      // Open Ports
      if (results.open_ports && Array.isArray(results.open_ports) && results.open_ports.length > 0) {
        const check = checkPageBreak(yPosition, pageHeight);
        if (check.needsBreak) {
          pdf.addPage();
          yPosition = check.newY;
        }

        yPosition = addSectionTitle(pdf, 'Açık Portlar', yPosition, pageHeight);

        const portData = results.open_ports
          .filter(p => !p.error)
          .map(port => [
            String(port.port || '—'),
            String(port.service || '—')
          ]);

        if (portData.length > 0) {
          pdf.autoTable({
            startY: yPosition,
            head: [['Port', 'Service']],
            body: portData,
            theme: 'grid',
            headStyles: { fillColor: [50, 50, 50], textColor: [255, 255, 255], fontStyle: 'bold' },
            bodyStyles: { textColor: [0, 0, 0], fontSize: 9 },
            alternateRowStyles: { fillColor: [245, 245, 245] },
            margin: { left: 15, right: 15 }
          });
          yPosition = pdf.lastAutoTable.finalY + 10;
        }
      }

      // SSL Certificate
      if (results.ssl_info && typeof results.ssl_info === 'object' && !results.ssl_info.error) {
        const check = checkPageBreak(yPosition, pageHeight);
        if (check.needsBreak) {
          pdf.addPage();
          yPosition = check.newY;
        }

        yPosition = addSectionTitle(pdf, 'SSL/TLS Sertifikası', yPosition, pageHeight);

        const sslData = [];
        if (results.ssl_info.data) {
          if (typeof results.ssl_info.data === 'object') {
            Object.entries(results.ssl_info.data).forEach(([key, value]) => {
              sslData.push([String(key), String(value || '—').substring(0, 60)]);
            });
          } else {
            sslData.push(['Bilgi', String(results.ssl_info.data).substring(0, 60)]);
          }
        }
        if (results.ssl_info.valid !== undefined) {
          sslData.push(['Geçerli', results.ssl_info.valid ? 'Evet' : 'Hayır']);
        }

        if (sslData.length > 0) {
          pdf.autoTable({
            startY: yPosition,
            head: [['Özellik', 'Değer']],
            body: sslData,
            theme: 'grid',
            headStyles: { fillColor: [50, 50, 50], textColor: [255, 255, 255], fontStyle: 'bold' },
            bodyStyles: { textColor: [0, 0, 0], fontSize: 9 },
            alternateRowStyles: { fillColor: [245, 245, 245] },
            margin: { left: 15, right: 15 }
          });
          yPosition = pdf.lastAutoTable.finalY + 10;
        }
      }

      // Emails
      if (results.emails && Array.isArray(results.emails) && results.emails.length > 0) {
        const check = checkPageBreak(yPosition, pageHeight);
        if (check.needsBreak) {
          pdf.addPage();
          yPosition = check.newY;
        }

        yPosition = addSectionTitle(pdf, 'Tespit Edilen E-postalar', yPosition, pageHeight);

        const emailData = results.emails
          .filter(e => !e.error)
          .map(email => [String(email).substring(0, 80)]);

        if (emailData.length > 0) {
          pdf.autoTable({
            startY: yPosition,
            head: [['E-posta Adresi']],
            body: emailData,
            theme: 'grid',
            headStyles: { fillColor: [50, 50, 50], textColor: [255, 255, 255], fontStyle: 'bold' },
            bodyStyles: { textColor: [0, 0, 0], fontSize: 9 },
            alternateRowStyles: { fillColor: [245, 245, 245] },
            margin: { left: 15, right: 15 }
          });
          yPosition = pdf.lastAutoTable.finalY + 10;
        }
      }

      // Admin Panels
      if (results.admin_panels && Array.isArray(results.admin_panels) && results.admin_panels.length > 0) {
        const check = checkPageBreak(yPosition, pageHeight);
        if (check.needsBreak) {
          pdf.addPage();
          yPosition = check.newY;
        }

        yPosition = addSectionTitle(pdf, 'Tespit Edilen Admin Panelleri', yPosition, pageHeight);

        const adminData = results.admin_panels
          .filter(a => !a.error)
          .map(panel => [String(panel).substring(0, 80)]);

        if (adminData.length > 0) {
          pdf.autoTable({
            startY: yPosition,
            head: [['URL']],
            body: adminData,
            theme: 'grid',
            headStyles: { fillColor: [50, 50, 50], textColor: [255, 255, 255], fontStyle: 'bold' },
            bodyStyles: { textColor: [0, 0, 0], fontSize: 9 },
            alternateRowStyles: { fillColor: [245, 245, 245] },
            margin: { left: 15, right: 15 }
          });
          yPosition = pdf.lastAutoTable.finalY + 10;
        }
      }

      // WHOIS Info
      if (results.whois && Array.isArray(results.whois) && results.whois.length > 0) {
        const check = checkPageBreak(yPosition, pageHeight);
        if (check.needsBreak) {
          pdf.addPage();
          yPosition = check.newY;
        }

        yPosition = addSectionTitle(pdf, 'WHOIS Bilgileri', yPosition, pageHeight);

        const whoisData = results.whois
          .filter(w => !w.error && typeof w === 'string')
          .map(info => [String(info).substring(0, 80)]);

        if (whoisData.length > 0) {
          pdf.autoTable({
            startY: yPosition,
            head: [['Bilgi']],
            body: whoisData,
            theme: 'grid',
            headStyles: { fillColor: [50, 50, 50], textColor: [255, 255, 255], fontStyle: 'bold' },
            bodyStyles: { textColor: [0, 0, 0], fontSize: 9 },
            alternateRowStyles: { fillColor: [245, 245, 245] },
            margin: { left: 15, right: 15 }
          });
          yPosition = pdf.lastAutoTable.finalY + 10;
        }
      }

      // Robots.txt
      if (results.robots_txt && typeof results.robots_txt === 'string' && results.robots_txt.length > 0 && !results.robots_txt.includes('unavailable')) {
        const check = checkPageBreak(yPosition, pageHeight);
        if (check.needsBreak) {
          pdf.addPage();
          yPosition = check.newY;
        }

        yPosition = addSectionTitle(pdf, 'robots.txt İçeriği', yPosition, pageHeight);

        const robitsLines = results.robots_txt.split('\n').filter(l => l.trim().length > 0);
        const robitsData = robitsLines.map(line => [line.substring(0, 80)]);

        if (robitsData.length > 0) {
          pdf.autoTable({
            startY: yPosition,
            head: [['Kural']],
            body: robitsData.slice(0, 20),
            theme: 'grid',
            headStyles: { fillColor: [50, 50, 50], textColor: [255, 255, 255], fontStyle: 'bold' },
            bodyStyles: { textColor: [0, 0, 0], fontSize: 8 },
            alternateRowStyles: { fillColor: [245, 245, 245] },
            margin: { left: 15, right: 15 }
          });
        }
      }

      // IP Info
      if (results.ip_info && typeof results.ip_info === 'object' && !results.ip_info.error) {
        const check = checkPageBreak(yPosition, pageHeight);
        if (check.needsBreak) {
          pdf.addPage();
          yPosition = check.newY;
        }

        yPosition = addSectionTitle(pdf, 'IP Bilgileri', yPosition, pageHeight);

        const ipData = [];
        Object.entries(results.ip_info).forEach(([key, value]) => {
          ipData.push([String(key), String(value || '—').substring(0, 60)]);
        });

        if (ipData.length > 0) {
          pdf.autoTable({
            startY: yPosition,
            head: [['Özellik', 'Değer']],
            body: ipData,
            theme: 'grid',
            headStyles: { fillColor: [50, 50, 50], textColor: [255, 255, 255], fontStyle: 'bold' },
            bodyStyles: { textColor: [0, 0, 0], fontSize: 9 },
            alternateRowStyles: { fillColor: [245, 245, 245] },
            margin: { left: 15, right: 15 }
          });
        }
      }

      pdf.save(`saldi-yuzeyi-${results.domain}-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error('Hata PDF dışarı aktarılırken:', err);
      alert('PDF export başarısız: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  const ResultTable = ({ title, data, columns }) => {
    if (!data || (Array.isArray(data) && data.length === 0)) return null;

    return (
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ color: '#fff', marginBottom: '10px', fontSize: '16px', fontWeight: '600' }}>{title}</h3>
        <div style={{
          backgroundColor: '#1a1a1a',
          borderRadius: '6px',
          overflow: 'hidden',
          border: '1px solid #444'
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            color: '#fff',
            fontSize: '13px'
          }}>
            <thead>
              <tr style={{ backgroundColor: '#2a2a2a', borderBottom: '1px solid #444' }}>
                {columns.map((col, idx) => (
                  <th key={idx} style={{
                    padding: '12px 15px',
                    textAlign: 'left',
                    fontWeight: '600',
                    color: '#fff',
                    borderRight: idx < columns.length - 1 ? '1px solid #333' : 'none'
                  }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, idx) => (
                <tr key={idx} style={{
                  backgroundColor: idx % 2 === 0 ? '#1a1a1a' : '#222',
                  borderBottom: '1px solid #333'
                }}>
                  {row.map((cell, cidx) => (
                    <td key={cidx} style={{
                      padding: '12px 15px',
                      borderRight: cidx < row.length - 1 ? '1px solid #333' : 'none',
                      wordBreak: 'break-word',
                      maxWidth: '500px',
                      color: cell && cell.toString().toLowerCase().includes('hata') ? '#ff6b6b' : '#fff'
                    }}>
                      {renderValue(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const InfoBox = ({ label, value }) => (
    <div style={{
      display: 'inline-block',
      marginRight: '20px',
      marginBottom: '15px'
    }}>
      <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '16px', color: '#fff', fontWeight: '600' }}>{renderValue(value)}</div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f0f0f', padding: '20px' }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        backgroundColor: '#1a1a1a',
        borderRadius: '8px',
        padding: '30px',
        color: '#fff',
        border: '1px solid #333'
      }}>
        <h1 style={{ color: '#fff', marginTop: 0, marginBottom: '30px' }}>Saldırı Yüzeyi Analizi</h1>

        <form onSubmit={handleSubmit} style={{ marginBottom: '30px' }}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#fff' }}>
              Domain Adı:
            </label>
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="örneğin: example.com"
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #444',
                borderRadius: '4px',
                fontSize: '14px',
                backgroundColor: '#2a2a2a',
                color: '#fff',
                boxSizing: 'border-box'
              }}
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '12px 30px',
              background: loading ? '#555' : '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              transition: 'background 0.3s'
            }}
          >
            {loading ? 'Taranıyor...' : 'Taramayı Başlat'}
          </button>
        </form>

        {error && (
          <div style={{
            background: '#2a1a1a',
            color: '#ff6b6b',
            padding: '15px',
            borderRadius: '4px',
            marginBottom: '20px',
            border: '1px solid #444'
          }}>
            ⚠️ {error}
          </div>
        )}

        {results && (
          <div>
            {/* Domain Info Cards */}
            <div style={{
              backgroundColor: '#2a2a2a',
              padding: '20px',
              borderRadius: '6px',
              marginBottom: '30px',
              border: '1px solid #444'
            }}>
              <h3 style={{ marginTop: 0, color: '#fff', marginBottom: '15px' }}>Temel Bilgiler</h3>
              <InfoBox label="Domain" value={results.domain} />
              <InfoBox label="IP Adresi" value={results.ip} />
            </div>

            {/* DNS Records */}
            {results.dns_records && results.dns_records.length > 0 && (
              <ResultTable
                title="DNS Kayıtları"
                columns={['Tür', 'Değer']}
                data={results.dns_records.map((record) => {
                  if (record.error) return ['Hata', record.error];
                  if (Array.isArray(record)) return [record[0], record[1]];
                  return [record, ''];
                })}
              />
            )}

            {/* Subdomains */}
            {results.subdomains && results.subdomains.length > 0 && (
              <ResultTable
                title="Bulunan Alt Domainler"
                columns={['Alt Domain']}
                data={results.subdomains.map((sub) => {
                  if (sub && sub.error) return ['Hata: ' + sub.error];
                  return [sub];
                })}
              />
            )}

            {/* WHOIS Info */}
            {results.whois && results.whois.length > 0 && (
              <ResultTable
                title="WHOIS Bilgileri"
                columns={['Bilgi', 'Değer']}
                data={results.whois.map((item) => {
                  if (item.error) return ['Hata', item.error];
                  if (Array.isArray(item)) return [item[0], item[1]];
                  return [item, ''];
                })}
              />
            )}

            {/* SSL Certificate */}
            {results.ssl_info && (
              <ResultTable
                title="SSL Sertifikası"
                columns={['Özellik', 'Durum']}
                data={[
                  ['Geçerlilik Durumu', results.ssl_info.valid ? '✓ Geçerli' : '✗ Geçersiz' || 'Hata'],
                  ['Detaylar', results.ssl_info.error ? 'Hata: ' + results.ssl_info.error : 'Mevcut']
                ]}
              />
            )}

            {/* Open Ports */}
            {results.open_ports && results.open_ports.length > 0 && (
              <ResultTable
                title="Açık Portlar"
                columns={['Port', 'Servis']}
                data={results.open_ports.map((port) => {
                  if (port.error) return ['Hata', port.error];
                  return [port.port, port.service];
                })}
              />
            )}

            {/* Emails */}
            {results.emails && results.emails.length > 0 && (
              <ResultTable
                title="Bulunan E-posta Adresleri"
                columns={['E-posta', 'Kaynak']}
                data={results.emails.map((email) => {
                  if (email.error) return ['Hata', email.error];
                  return [email.email || email, email.source || ''];
                })}
              />
            )}

            {/* Admin Panels */}
            {results.admin_panels && results.admin_panels.length > 0 && (
              <ResultTable
                title="Admin Panelleri"
                columns={['URL', 'Durum', 'Detay']}
                data={results.admin_panels.map((panel) => {
                  if (panel.error) return ['Hata', panel.error, ''];
                  return [panel.url || panel, panel.status || 'N/A', panel.detail || ''];
                })}
              />
            )}

            {/* Robots.txt */}
            {results.robots_txt && (
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ color: '#fff', marginBottom: '10px', fontSize: '16px', fontWeight: '600' }}>Robots.txt</h3>
                <div style={{
                  backgroundColor: '#1a1a1a',
                  borderRadius: '6px',
                  padding: '15px',
                  border: '1px solid #444',
                  maxHeight: '300px',
                  overflow: 'auto'
                }}>
                  <pre style={{
                    margin: 0,
                    color: '#fff',
                    fontSize: '12px',
                    whiteSpace: 'pre-wrap',
                    wordWrap: 'break-word',
                    fontFamily: 'monospace'
                  }}>
                    {typeof results.robots_txt === 'string' ? results.robots_txt : 'Hata: ' + results.robots_txt}
                  </pre>
                </div>
              </div>
            )}

            {/* IP Info */}
            {results.ip_info && (
              <ResultTable
                title="IP Bilgileri"
                columns={['Bilgi']}
                data={[[typeof results.ip_info === 'string' ? results.ip_info : JSON.stringify(results.ip_info)]]}
              />
            )}
          </div>
        )}

        <div style={{ marginTop: '30px', display: 'flex', gap: '10px' }}>
          {results && (
            <button
              onClick={exportPDF}
              disabled={exporting}
              style={{
                padding: '12px 30px',
                background: exporting ? '#555' : '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: exporting ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              {exporting ? 'PDF Oluşturuluyor...' : '📄 PDF Olarak İndir'}
            </button>
          )}
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              padding: '12px 30px',
              background: '#444',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            ← Dashboard'a Dön
          </button>
        </div>
      </div>
    </div>
  );
}