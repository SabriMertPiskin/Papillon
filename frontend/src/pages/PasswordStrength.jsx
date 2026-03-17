import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { predictPasswordStrength } from '../services/api';
import '../styles/PasswordStrength.css';

const IconKey = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
  </svg>
);

const IconEye = ({ open }) => open ? (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>
  </svg>
) : (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
    <line x1="1" y1="1" x2="23" y2="23"></line>
  </svg>
);

const IconAlert = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>
  </svg>
);

const IconLightbulb = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="9" y1="18" x2="15" y2="18"></line><line x1="10" y1="22" x2="14" y2="22"></line>
    <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"></path>
  </svg>
);

// Client-side criteria checks (runs immediately on keystroke)
function evaluateCriteria(password) {
  return {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
    noCommon: !['password', '123456', 'qwerty', 'abc123', '111111'].some(c => password.toLowerCase().includes(c)),
  };
}

// Client-side strength estimate (shown without backend)
function estimateStrength(criteria) {
  const passed = Object.values(criteria).filter(Boolean).length;
  if (passed <= 2) return { label: 'Zayıf', level: 'weak', pct: 20 };
  if (passed <= 4) return { label: 'Orta', level: 'medium', pct: 60 };
  return { label: 'Güçlü', level: 'strong', pct: 100 };
}

const CRITERIA_LABELS = {
  length: 'En az 8 karakter',
  uppercase: 'Büyük harf (A-Z)',
  lowercase: 'Küçük harf (a-z)',
  number: 'Rakam (0-9)',
  special: 'Özel karakter (!@#...)',
  noCommon: 'Yaygın ifade içermiyor',
};

export default function PasswordStrength() {
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null); // backend AI result
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
    if (!isAuthenticated) navigate('/login');
    const theme = localStorage.getItem('papillon-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  }, [navigate]);

  const criteria = evaluateCriteria(password);
  const clientStrength = estimateStrength(criteria);
  
  // Display either AI result or client estimate
  const displayStrength = aiResult || (password.length > 0 ? clientStrength : null);

  const strengthLabel = aiResult
    ? { 0: 'Zayıf', 1: 'Orta', 2: 'Güçlü' }[aiResult.strength_level] ?? aiResult.label
    : clientStrength.label;

  const strengthLevel = aiResult
    ? { 0: 'weak', 1: 'medium', 2: 'strong' }[aiResult.strength_level] ?? aiResult.level
    : clientStrength.level;

  const strengthPct = aiResult ? { weak: 20, medium: 60, strong: 100 }[strengthLevel] : clientStrength.pct;

  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    setError('');
    setAiResult(null);
    try {
      const resp = await predictPasswordStrength(password);
      if (resp.data) {
        setAiResult({
          strength_level: resp.data.strength_level,
          label: ['Zayıf', 'Orta', 'Güçlü'][resp.data.strength_level] ?? 'Bilinmiyor',
          level: ['weak', 'medium', 'strong'][resp.data.strength_level] ?? 'medium',
          features: resp.data.features || null,
          ai: true,
        });
      }
    } catch {
      setError('AI analizi şu an kullanılamıyor. Aşağıdaki kriter değerlendirmesi kullanılıyor.');
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    !criteria.length && 'Şifrenizi 8 karakterden uzun yapın.',
    !criteria.uppercase && 'En az bir büyük harf ekleyin (A-Z).',
    !criteria.lowercase && 'En az bir küçük harf ekleyin (a-z).',
    !criteria.number && 'En az bir rakam ekleyin (0-9).',
    !criteria.special && '!, @, #, $ gibi özel karakter ekleyin.',
    !criteria.noCommon && '"password", "123456" gibi tahmin edilebilir ifadelerden kaçının.',
  ].filter(Boolean);

  const strengthDescriptions = {
    weak: 'Şifreniz tahmin edilmesi kolay. Lütfen güçlendirin.',
    medium: 'Şifreniz kabul edilebilir fakat daha güçlü yapılabilir.',
    strong: 'Harika! Şifreniz güvenlik standartlarını karşılıyor.',
  };

  return (
    <div className="ps-layout">
      {/* Header */}
      <div className="ps-header">
        <div className="ps-title-group">
          <div className="ps-header-icon"><IconKey /></div>
          <div>
            <h1>Şifre Güçlülük Analizi</h1>
            <p>AI destekli şifre güvenliği değerlendirmesi</p>
          </div>
        </div>
        <button className="back-btn" onClick={() => navigate('/dashboard')}>← Dashboard'a Dön</button>
      </div>

      {/* Main Card */}
      <div className="ps-card">
        {/* Error */}
        {error && (
          <div className="ps-alert">
            <IconAlert /> {error}
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleAnalyze}>
          <div className="ps-input-group">
            <div className="ps-input-wrapper">
              <span className="ps-input-icon">
                <IconKey />
              </span>
              <input
                className="ps-input"
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setAiResult(null); }}
                placeholder="Analiz etmek istediğiniz şifreyi girin..."
                autoFocus
              />
              <button
                type="button"
                className="ps-eye-btn"
                onClick={() => setShowPw(p => !p)}
              >
                <IconEye open={showPw} />
              </button>
            </div>
            <button
              type="submit"
              className="ps-analyze-btn"
              disabled={loading || !password}
            >
              {loading ? 'Analiz...' : 'AI Analizi'}
            </button>
          </div>
        </form>

        {/* Strength Meter */}
        {password.length > 0 && (
          <>
            {/* Score Display */}
            <div className="ps-score-display">
              <div className={`ps-score-circle ${strengthLevel}`}>
                <span style={{ fontSize: '0.6rem', fontWeight: 600, opacity: 0.8, marginBottom: 2 }}>SEVİYE</span>
                {strengthPct}
              </div>
              <div className="ps-score-info">
                <h3 style={{ color: strengthLevel === 'weak' ? '#ef5350' : strengthLevel === 'medium' ? '#fbc02d' : '#4caf50' }}>
                  {strengthLabel}
                  {aiResult?.ai && <span style={{ fontSize: '0.7rem', marginLeft: 8, color: 'var(--auth-teal)', fontWeight: 400 }}>AI Sonucu</span>}
                </h3>
                <p>{strengthDescriptions[strengthLevel]}</p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="ps-meter-section">
              <div className="ps-meter-label">
                <span className="ps-meter-title">Güvenlik Skoru</span>
                <span className={`ps-meter-result ${strengthLevel}`}>{strengthLabel}</span>
              </div>
              <div className="ps-meter-track">
                <div
                  className={`ps-meter-fill ${strengthLevel}`}
                  style={{ width: `${strengthPct}%` }}
                />
              </div>
            </div>

            {/* Criteria Checklist */}
            <div className="ps-criteria-grid">
              {Object.entries(criteria).map(([key, passed]) => (
                <div key={key} className={`ps-criteria-item ${passed ? 'pass' : 'fail'}`}>
                  <div className="ps-criteria-dot" />
                  {CRITERIA_LABELS[key]}
                </div>
              ))}
            </div>

            {/* Suggestions */}
            {suggestions.length > 0 && (
              <div className="ps-suggestions">
                <h4><IconLightbulb /> Güçlendirme Önerileri</h4>
                <ul>
                  {suggestions.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}
          </>
        )}

        {/* Idle state */}
        {password.length === 0 && (
          <div className="ps-idle">
            <div className="ps-idle-icon"><IconKey /></div>
            <p>Bir şifre girin — anında güvenlik analizi yapılacak</p>
          </div>
        )}
      </div>
    </div>
  );
}
