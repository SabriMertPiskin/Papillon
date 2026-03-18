import React, { useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import '../styles/PhishingHistory.css';

// Mock Data for UI
const mockPhishingLogs = [
  {
    id: 1,
    date: '2026-03-18 01:10:05',
    sender: 'support@account-paypal.com.tr',
    subject: 'Security Alert: Your Account Has Been Restricted!',
    preview: 'Dear customer, we have detected suspicious activity on your account. Please click the link below to...',
    score: 98,
    status: 'phishing',
    aiReasons: [
      'Sender address (account-paypal.com.tr) does not match the official domain (paypal.com).',
      'Email content creates a sense of urgency to force the recipient to click.',
      'Link analysis: The redirect page is not a known OAuth or Login page, it is a newly registered domain.'
    ],
    fullBody: 'Dear customer,\n\nWe have detected suspicious activity on your account. For your security, a temporary restriction has been placed on your account.\n\nTo lift the restriction and verify your account, please click the following link and sign in within 24 hours:\n\nhttp://verify-account-paypal-tr.com/login/auth=192831\n\nOtherwise, your account will be permanently closed.\n\nBest regards,\nPayPal Support Team'
  },
  {
    id: 2,
    date: '2026-03-17 14:22:18',
    sender: 'it-dept@company-domain.com',
    subject: 'Payroll Statement View',
    preview: 'The attached file contains your payroll statement for this month. To view it...',
    score: 85,
    status: 'phishing',
    aiReasons: [
      'Attached file (Payroll.pdf.exe) is a double-extension malware (Executable).',
      'Although the email appears to be from the IT department, the Reply-To address is different (hacker@mail-ru.com).',
      'Social engineering: Salary/Money theme.'
    ],
    fullBody: 'Hello,\n\nThe attached file contains your payroll statement for this month.\nPlease download and review it.\n\nBest regards,\nHuman Resources'
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
      'Sender address and DKIM/SPF records match the official GitHub servers.',
      'All links in the content point to the https://github.com/ domain.',
      'Does not contain any suspicious language or urgency.'
    ],
    fullBody: 'Hey Sabri Mert,\n\nSomeone started following you on GitHub.\n\nView their profile here: https://github.com/new-follower\n\nThanks,\nThe GitHub Team'
  },
  {
    id: 4,
    date: '2026-03-16 19:40:11',
    sender: 'admin@netflix-subscription.net',
    subject: 'Payment Failed!',
    preview: 'Your Netflix subscription is about to be cancelled. Please update your card information.',
    score: 65,
    status: 'suspicious',
    aiReasons: [
      'Sender domain (netflix-subscription.net) is not the official Netflix domain, although Netflix infrastructure may also be in use. Suspicious.',
      'Emotional manipulation (subscription cancellation) is present.',
      'Redirect link gives an SSL error.'
    ],
    fullBody: 'Hello,\n\nYour last payment could not be charged from your credit card. Your Netflix service is about to be cancelled.\nTo continue, update your payment method at the link below:\n\nhttp://netflix-subscription.net/update-billing\n\nNetflix Team'
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
    if (status === 'phishing') return 'PHISHING (DANGER)';
    if (status === 'suspicious') return 'SUSPICIOUS';
    return 'CLEAN (SAFE)';
  };

  const closeModal = () => setSelectedLog(null);

  return (
    <DashboardLayout>
      <div className="phishing-page-container">
        <div className="phishing-header">
          <div className="phishing-title-section">
            <h1>🎣 AI Phishing Alert History</h1>
            <p>Recent email analysis reports scanned and scored by our AI models.</p>
          </div>
          
          <div className="phishing-stats-mini">
            <div className="p-stat-box danger">
              <span className="p-stat-num">24</span>
              <span className="p-stat-lbl">Blocked Phishing</span>
            </div>
            <div className="p-stat-box">
              <span className="p-stat-num">8</span>
              <span className="p-stat-lbl">Suspicious Detected</span>
            </div>
            <div className="p-stat-box safe">
              <span className="p-stat-num">1.4K</span>
              <span className="p-stat-lbl">Clean Emails</span>
            </div>
          </div>
        </div>

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
          {filteredLogs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px', color: 'var(--auth-text-muted)' }}>
              No logs matching the search criteria.
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
                  <span className="p-score-lbl">Risk Score</span>
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
                  {selectedLog.aiReasons.map((reason, idx) => (
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
                <button 
                  className="modal-btn" 
                  onClick={() => alert(`Preparing Analysis PDF Report: ${selectedLog.id}_report.pdf`)}
                  style={{ background: 'transparent', border: '1px solid var(--auth-accent)', color: 'var(--auth-accent)' }}
                >
                  📄 Download PDF
                </button>
                <button className="modal-btn primary" onClick={closeModal}>Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
