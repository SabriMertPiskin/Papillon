import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { predictPasswordStrength, predictPasswordStrengthFastApi } from '../services/api';
import DashboardLayout from '../components/DashboardLayout';
import '../styles/PasswordStrength.css';

export default function PasswordStrength() {
  const [password, setPassword] = useState('');
  const [strength, setStrength] = useState(null);
  const [criteria, setCriteria] = useState([]);
  const [aiResult, setAiResult] = useState(null);
  const [aiSource, setAiSource] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const getStrengthClass = (level) => {
    const normalized = String(level || '').toLowerCase();
    if (normalized.includes('strong')) return 'strong';
    if (normalized.includes('moderate') || normalized.includes('normal')) return 'medium';
    return 'weak';
  };

  useEffect(() => {
    const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    const theme = localStorage.getItem('papillon-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  }, [navigate]);

  const analyzePassword = (pwd) => {
    if (!pwd) {
      setStrength(null);
      setCriteria([]);
      return;
    }

    const checks = [
      { label: 'At least 8 characters', passed: pwd.length >= 8 },
      { label: 'At least 12 characters (strong)', passed: pwd.length >= 12 },
      { label: 'Contains uppercase letter', passed: /[A-Z]/.test(pwd) },
      { label: 'Contains lowercase letter', passed: /[a-z]/.test(pwd) },
      { label: 'Contains number', passed: /\d/.test(pwd) },
      { label: 'Contains special character (!@#$%^&*)', passed: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/.test(pwd) },
      {
        label: 'Not a common password',
        passed: !['123456', 'password', 'qwerty', '123456789', '12345678', '111111', '1234567', 'sunshine', 'iloveyou', 'princess'].includes(pwd.toLowerCase())
      },
    ];

    setCriteria(checks);

    const passedCount = checks.filter((c) => c.passed).length;
    let level = 'Very Weak';
    let color = '#ef5350';
    let percent = 10;

    if (passedCount >= 7) {
      level = 'Very Strong';
      color = '#4caf50';
      percent = 100;
    } else if (passedCount >= 5) {
      level = 'Strong';
      color = '#66bb6a';
      percent = 75;
    } else if (passedCount >= 4) {
      level = 'Moderate';
      color = '#ff9800';
      percent = 50;
    } else if (passedCount >= 2) {
      level = 'Weak';
      color = '#ff5722';
      percent = 30;
    }

    setStrength({ level, color, percent });
  };

  const handleChange = (e) => {
    const val = e.target.value;
    setPassword(val);
    analyzePassword(val);
    setAiResult(null);
    setAiSource(null);
  };

  const handleAiCheck = async () => {
    if (!password) return;

    setLoading(true);
    setAiResult(null);
    setAiSource(null);

    try {
      // Primary path: FastAPI bridge endpoint
      const fastApiResponse = await predictPasswordStrengthFastApi(password);
      if (fastApiResponse.data.success) {
        setAiResult(fastApiResponse.data);
        setAiSource('FastAPI');
        return;
      }
      setAiResult({ error: fastApiResponse.data.detail || 'Analysis failed' });
    } catch (fastApiErr) {
      // Fallback path: existing Django endpoint
      try {
        const djangoResponse = await predictPasswordStrength(password);
        if (djangoResponse.data.success) {
          setAiResult(djangoResponse.data);
          setAiSource('Django fallback');
        } else {
          setAiResult({ error: djangoResponse.data.detail || 'Analysis failed' });
        }
      } catch (djangoErr) {
        setAiResult({
          error:
            djangoErr.response?.data?.detail ||
            fastApiErr.response?.data?.detail ||
            'Server error. FastAPI and Django endpoints could not be reached.',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="ps-layout">
        <div className="ps-header">
          <div className="ps-title-group">
            <div className="ps-header-icon">🔑</div>
            <div>
              <h1>Password Strength Analysis</h1>
              <p>AI-powered password security assessment. Detect and improve weak passwords.</p>
            </div>
          </div>
          <button className="back-btn" onClick={() => navigate('/dashboard')}>
            ← Dashboard
          </button>
        </div>

        <div className="ps-card">
          <div className="ps-input-group">
            <div className="ps-input-wrapper">
              <span className="ps-input-icon">🔒</span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={handleChange}
                placeholder="Type a password to test..."
                className="ps-input"
                autoFocus
              />
              <button
                type="button"
                className="ps-eye-btn"
                onClick={() => setShowPassword(!showPassword)}
                aria-label="Toggle password visibility"
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
            <button className="ps-analyze-btn" onClick={handleAiCheck} disabled={loading || !password}>
              {loading ? 'Analyzing...' : 'AI Check'}
            </button>
          </div>

          {!password && (
            <div className="ps-idle">
              <div className="ps-idle-icon">🔑</div>
              <div>Enter a password to start strength analysis.</div>
            </div>
          )}

          {strength && (
            <>
              <div className="ps-score-display">
                <div className={`ps-score-circle ${getStrengthClass(strength.level)}`}>
                  {strength.percent}
                </div>
                <div className="ps-score-info">
                  <h3>{strength.level}</h3>
                  <p>Estimated security score</p>
                </div>
              </div>

              <div className="ps-meter-section">
                <div className="ps-meter-label">
                  <span className="ps-meter-title">Strength meter</span>
                  <span className={`ps-meter-result ${getStrengthClass(strength.level)}`}>
                    {strength.level}
                  </span>
                </div>
                <div className="ps-meter-track">
                  <div
                    className={`ps-meter-fill ${getStrengthClass(strength.level)}`}
                    style={{ width: `${strength.percent}%` }}
                  />
                </div>
              </div>
            </>
          )}

          {criteria.length > 0 && (
            <div className="ps-criteria-grid">
              {criteria.map((c, i) => (
                <div key={i} className={`ps-criteria-item ${c.passed ? 'pass' : 'fail'}`}>
                  <span className="ps-criteria-dot"></span>
                  <span>{c.label}</span>
                </div>
              ))}
            </div>
          )}

          {aiResult && (
            <>
              {aiResult.error ? (
                <div className="ps-alert">⚠ {aiResult.error}</div>
              ) : (
                <div className="ps-suggestions">
                  <h4>🤖 AI Assessment: {aiResult.prediction}</h4>
                  {aiSource && <p style={{ marginTop: 0, opacity: 0.8 }}>Source: {aiSource}</p>}
                  <ul>
                    {(aiResult.suggestions || []).map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          <div className="ps-suggestions" style={{ marginTop: '20px' }}>
            <h4>💡 Strong Password Tips</h4>
            <ul>
              <li>Use at least 12 characters (longer is more secure)</li>
              <li>Mix uppercase, lowercase, numbers and symbols</li>
              <li>Avoid personal information such as names and dates</li>
              <li>Use unique passwords for different systems</li>
              <li>Enable MFA for an extra security layer</li>
            </ul>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
