import React, { useState } from 'react';
import '../styles/PhishingHistory.css';

// Mock Data for UI
const mockPhishingLogs = [
  {
    id: 1,
    date: '2026-03-18 01:10:05',
    sender: 'support@account-paypal.com.tr',
    subject: 'Güvenlik Uyarısı: Hesabınız Kısıtlandı!',
    preview: 'Değerli müşterimiz, hesabınızda şüpheli işlemler tespit ettik. Lütfen aşağıdaki linkten...',
    score: 98,
    status: 'phishing',
    aiReasons: [
      'Gönderici adresi (account-paypal.com.tr) resmi domain (paypal.com) değil.',
      'Mail içeriğinde aciliyet (urgency) duygusu yaratarak tıklamaya zorluyor.',
      'Link analizi: Yönlendirilen sayfa bilindik bir Oauth veya Login sayfası değil, yeni kaydedilmiş domain.'
    ],
    fullBody: 'Değerli müşterimiz,\n\nHesabınızda şüpheli işlemler tespit ettik. Güvenliğiniz için hesabınıza geçici bir kısıtlama getirilmiştir.\n\nKısıtlamayı kaldırmak ve hesabınızı doğrulamak için lütfen 24 saat içinde aşağıdaki bağlantıya tıklayarak giriş yapınız:\n\nhttp://verify-account-paypal-tr.com/login/auth=192831\n\nAksi takdirde hesabınız kalıcı olarak kapatılacaktır.\n\nSaygılarımızla,\nPayPal Destek Ekibi'
  },
  {
    id: 2,
    date: '2026-03-17 14:22:18',
    sender: 'it-dept@sirket-domaini.com',
    subject: 'Maaş Bordrosu Görüntüleme',
    preview: 'Ekteki dosyada bu aya ait maaş bordronuz bulunmaktadır. Görüntülemek için...',
    score: 85,
    status: 'phishing',
    aiReasons: [
      'Ekli dosya (Bordro.pdf.exe) çift uzantılı bir zararlı yazılım (Executable).',
      'Mail IT departmanından gelmiş gibi görünse de Reply-To adresi farklı (hacker@mail-ru.com).',
      'Sosyal mühendislik: Maaş/Para teması.'
    ],
    fullBody: 'Merhaba,\n\nEkteki dosyada bu aya ait maaş bordronuz bulunmaktadır. \nLütfen indirip kontrol edin.\n\nİyi çalışmalar,\nİnsan Kaynakları'
  },
  {
    id: 3,
    date: '2026-03-17 09:15:42',
    sender: 'no-reply@github.com',
    subject: '[GitHub] You have a new follower',
    preview: 'Sabri Mert started following you on GitHub. Checkout their profile here...',
    score: 5,
    status: 'clean',
    aiReasons: [
      'Gönderici adresi ve DKIM/SPF kayıtları resmi GitHub sunucuları ile eşleşiyor.',
      'İçerikteki tüm bağlantılar https://github.com/ alan adına gidiyor.',
      'Herhangi bir şüpheli dil veya aciliyet içermiyor.'
    ],
    fullBody: 'Hey Sabri Mert,\n\nSomeone started following you on GitHub.\n\nView their profile here: https://github.com/new-follower\n\nThanks,\nThe GitHub Team'
  },
  {
    id: 4,
    date: '2026-03-16 19:40:11',
    sender: 'admin@netflix-subscription.net',
    subject: 'Ödemeniz Alınamadı!',
    preview: 'Netflix aboneliğiniz iptal edilmek üzeredir. Lütfen kart bilgilerinizi güncelleyin.',
    score: 65,
    status: 'suspicious',
    aiReasons: [
      'Gönderici domain (netflix-subscription.net) resmi Netflix domaini değil, ancak Netflix altyapısı da kullanılıyor olabilir. Şüpheli.',
      'Duygu manipülasyonu (Abonelik iptali) mevcut.',
      'Yönlendirilen bağlantı SSL hatası veriyor.'
    ],
    fullBody: 'Merhaba,\n\nSon ödemeniz kredi kartınızdan çekilemedi. Netflix hizmetiniz kapanmak üzeredir. \nDevam etmek için aşağıdaki bağlantıdan ödeme yönteminizi güncelleyin:\n\nhttp://netflix-subscription.net/update-billing\n\nNetflix Ekibi'
  }
];

export default function PhishingHistory() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedLog, setSelectedLog] = useState(null);

  const filteredLogs = mockPhishingLogs.filter(log => {
    const matchesSearch = log.subject.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          log.sender.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || log.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusLabel = (status) => {
    if (status === 'phishing') return 'PHISHING (TEHLİKE)';
    if (status === 'suspicious') return 'ŞÜPHELİ';
    return 'TEMİZ (GÜVENLİ)';
  };

  const closeModal = () => setSelectedLog(null);

  return (
    <div className="phishing-page-container">
      <div className="phishing-header">
        <div className="phishing-title-section">
          <h1>🎣 AI Phishing Alarm Geçmişi</h1>
          <p>Yapay zeka modellerimiz tarafından taranan ve skorlanan son e-posta analiz dökümleri.</p>
        </div>
        
        <div className="phishing-stats-mini">
          <div className="p-stat-box danger">
            <span className="p-stat-num">24</span>
            <span className="p-stat-lbl">Engellenen Oltalama</span>
          </div>
          <div className="p-stat-box">
            <span className="p-stat-num">8</span>
            <span className="p-stat-lbl">Şüpheli Tespit</span>
          </div>
          <div className="p-stat-box safe">
            <span className="p-stat-num">1.4K</span>
            <span className="p-stat-lbl">Temiz Mail</span>
          </div>
        </div>
      </div>

      <div className="phishing-filters">
        <input 
          type="text" 
          className="filter-input" 
          placeholder="Gönderen (Sender) veya Konuya (Subject) göre ara..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select 
          className="filter-select"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="all">Tüm Taramalar</option>
          <option value="phishing">Sadece Kritik (Phishing)</option>
          <option value="suspicious">Sadece Şüpheli</option>
          <option value="clean">Sadece Güvenli</option>
        </select>
      </div>

      <div className="phishing-grid">
        {filteredLogs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px', color: 'var(--auth-text-muted)' }}>
            Arama kriterlerine uygun log bulunamadı.
          </div>
        ) : (
          filteredLogs.map(log => (
            <div 
              key={log.id} 
              className={`phishing-card status-${log.status}`}
              onClick={() => setSelectedLog(log)}
            >
              <div className="p-card-score">
                <span className="p-score-val">{log.score}</span>
                <span className="p-score-lbl">Risk V.</span>
              </div>
              
              <div className="p-card-content">
                <div className="p-card-header">
                  <h3 className="p-subject">{log.subject}</h3>
                  <span className={`p-badge ${log.status}`}>{getStatusLabel(log.status)}</span>
                </div>
                <div className="p-sender">{log.sender}</div>
                <div className="p-preview">{log.preview}</div>
              </div>

              <div className="p-card-meta">
                <span className="p-date">{log.date}</span>
                <button className="p-action-btn">Analizi İncele →</button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Detail Modal Overlays (Reusing global modal structure with local content) */}
      {selectedLog && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content wide" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <div className="phishing-modal-header">
              <h2>
                <span style={{ fontSize: '1.8rem' }}>{selectedLog.status === 'clean' ? '✅' : '🚨'}</span>
                AI Phishing Raporu
              </h2>
              <span className={`p-badge ${selectedLog.status}`}>{getStatusLabel(selectedLog.status)} - Risk Skoru: {selectedLog.score}/100</span>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '8px', border: '1px solid var(--auth-glass-border)' }}>
              <div style={{ marginBottom: '10px' }}><strong>Tarih:</strong> {selectedLog.date}</div>
              <div style={{ marginBottom: '10px' }}><strong>Gönderen:</strong> <span style={{ color: '#64b5f6', fontFamily: 'monospace' }}>{selectedLog.sender}</span></div>
              <div><strong>Konu:</strong> {selectedLog.subject}</div>
            </div>

            <div className={`ai-reasoning-box ${selectedLog.status === 'clean' ? 'safe' : ''}`}>
              <h4>🤖 Yapay Zeka Karar Gerekçeleri (Explainable AI)</h4>
              <ul className="ai-reasoning-list">
                {selectedLog.aiReasons.map((reason, idx) => (
                  <li key={idx} style={{ marginBottom: '8px' }}>{reason}</li>
                ))}
              </ul>
            </div>

            <div style={{ marginTop: '20px' }}>
              <h4 style={{ marginBottom: '10px', color: 'var(--auth-text-secondary)' }}>Mail Ham İçeriği (Gövde)</h4>
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
              <button 
                className="modal-btn" 
                onClick={() => alert(`Analiz PDF Raporu Hazırlanıyor: ${selectedLog.id}_rapor.pdf`)}
                style={{ background: 'transparent', border: '1px solid var(--auth-accent)', color: 'var(--auth-accent)' }}
              >
                📄 PDF İndir
              </button>
              <button className="modal-btn primary" onClick={closeModal}>Kapat</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
