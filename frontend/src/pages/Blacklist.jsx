import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBlacklist, addBlacklist, deleteBlacklist } from '../services/api';
import '../styles/Blacklist.css';

const IconBan = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
  </svg>
);

const IconServer = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
    <line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line>
  </svg>
);

const IconPlus = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);

const IconTrash = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
  </svg>
);

const IconList = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line>
    <line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line>
    <line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line>
  </svg>
);

// Validate IPv4 or IPv6
const isValidIP = (ip) => {
  const ipv4 = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
  const ipv6 = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}(\/\d{1,3})?$/;
  if (ipv4.test(ip)) {
    const parts = ip.split('/')[0].split('.');
    return parts.every(p => parseInt(p) <= 255);
  }
  return ipv6.test(ip);
};

// Fallback mock data — shown when backend is unavailable
const MOCK_DATA = [
  { id: 1, ip_address: '192.168.1.100', reason: 'Kaba kuvvet saldırısı tespit edildi', created_at: '2026-03-15T10:30:00Z' },
  { id: 2, ip_address: '10.0.0.55', reason: 'Port tarama girişimi', created_at: '2026-03-14T08:20:00Z' },
  { id: 3, ip_address: '203.0.113.42', reason: 'Şüpheli aktivite', created_at: '2026-03-13T14:10:00Z' },
];

export default function Blacklist() {
  const [list, setList] = useState([]);
  const [ip, setIp] = useState('');
  const [reason, setReason] = useState('');
  const [ipError, setIpError] = useState('');
  const [adding, setAdding] = useState(false);
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [useMock, setUseMock] = useState(false);
  const navigate = useNavigate();

  const showAlert = (msg, type = 'success') => {
    setAlert({ msg, type });
    setTimeout(() => setAlert(null), 3500);
  };

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await getBlacklist();
      setList(resp.data || []);
      setUseMock(false);
    } catch {
      setList(MOCK_DATA);
      setUseMock(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
    if (!isAuthenticated) navigate('/login');
    const theme = localStorage.getItem('papillon-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    fetchList();
  }, [navigate, fetchList]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setIpError('');
    if (!ip.trim()) { setIpError('IP adresi zorunludur.'); return; }
    if (!isValidIP(ip.trim())) { setIpError('Geçersiz IPv4 veya IPv6 adresi.'); return; }

    setAdding(true);
    try {
      await addBlacklist(ip.trim(), reason.trim());
      setIp('');
      setReason('');
      showAlert('IP adresi başarıyla engellendi ✓');
      await fetchList();
    } catch {
      if (useMock) {
        const newEntry = { id: Date.now(), ip_address: ip.trim(), reason: reason.trim() || 'Manuel eklendi', created_at: new Date().toISOString() };
        setList(prev => [newEntry, ...prev]);
        setIp(''); setReason('');
        showAlert('IP eklendi (Demo mod — backend bağlantısı yok)');
      } else {
        showAlert('IP eklenirken hata oluştu', 'error');
      }
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id, ipAddr) => {
    if (!window.confirm(`${ipAddr} adresini engel listesinden kaldırmak istediğinize emin misiniz?`)) return;
    try {
      await deleteBlacklist(id);
      showAlert('IP adresi engelinden kaldırıldı');
      await fetchList();
    } catch {
      setList(prev => prev.filter(item => item.id !== id));
      showAlert('IP silindi (Demo mod)', 'success');
    }
  };

  const formatDate = (dt) => {
    try {
      return new Date(dt).toLocaleString('tr-TR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch { return dt; }
  };

  return (
    <div className="bl-layout">
      {/* Header */}
      <div className="bl-header">
        <div className="bl-title-group">
          <div className="bl-header-icon"><IconBan /></div>
          <div>
            <h1>IP Engel Listesi</h1>
            <p>Şüpheli IP adreslerini yönetin — IPv4 ve IPv6 destekler</p>
          </div>
        </div>
        <button className="back-btn" onClick={() => navigate('/dashboard')}>← Dashboard'a Dön</button>
      </div>

      {/* Alert */}
      {alert && (
        <div className={`bl-alert ${alert.type}`} style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 900, marginBottom: 16 }}>
          {alert.type === 'success' ? '✓' : '✗'} {alert.msg}
          {useMock && !alert.msg.includes('Demo') && <span style={{ marginLeft: 8, fontSize: '0.8rem', opacity: 0.7 }}>(Demo mod)</span>}
        </div>
      )}

      {/* Add Card */}
      <div className="bl-add-card">
        <h3><IconPlus /> Yeni IP Engelle</h3>
        {useMock && (
          <div className="bl-alert error" style={{ marginBottom: 16 }}>
            ⚠ Backend bağlantısı yok — Demo mod aktif. Değişiklikler kaydedilmez.
          </div>
        )}
        <form className="bl-form" onSubmit={handleAdd}>
          <div className="bl-input-wrap">
            <span className="bl-input-icon"><IconServer /></span>
            <input
              className={`bl-input ${ipError ? 'has-error' : ''}`}
              type="text"
              placeholder="IP Adresi (örn: 192.168.1.1)"
              value={ip}
              onChange={e => { setIp(e.target.value); setIpError(''); }}
            />
            {ipError && <div className="bl-error-text">{ipError}</div>}
          </div>
          <div className="bl-input-reason">
            <input
              className="bl-input plain"
              type="text"
              placeholder="Engelleme sebebi (isteğe bağlı)"
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
          </div>
          <button type="submit" className="bl-add-btn" disabled={adding}>
            <IconPlus />
            {adding ? 'Ekleniyor...' : 'Engelle'}
          </button>
        </form>
      </div>

      {/* Table */}
      <div className="bl-table-card">
        <div className="bl-table-header">
          <h3><IconList /> Engellenen IP'ler</h3>
          <span className="bl-badge">{list.length} kayıt</span>
        </div>
        <div className="bl-table-wrapper">
          {loading ? (
            <div className="bl-empty"><p>Yükleniyor...</p></div>
          ) : list.length === 0 ? (
            <div className="bl-empty">
              <div className="bl-empty-icon"><IconBan /></div>
              <p>Engellenen IP adresi yok</p>
            </div>
          ) : (
            <table className="bl-table">
              <thead>
                <tr>
                  <th>IP Adresi</th>
                  <th>Sebep</th>
                  <th>Tarih</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {list.map(item => (
                  <tr key={item.id}>
                    <td><span className="bl-ip-cell">{item.ip_address}</span></td>
                    <td><span className="bl-reason-cell">{item.reason || '—'}</span></td>
                    <td><span className="bl-date-cell">{formatDate(item.created_at)}</span></td>
                    <td>
                      <button
                        className="bl-delete-btn"
                        onClick={() => handleDelete(item.id, item.ip_address)}
                      >
                        <IconTrash /> Kaldır
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
