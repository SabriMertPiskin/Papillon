import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import DashboardLayout from '../components/DashboardLayout';
import '../styles/PasswordStrength.css';

export default function PasswordStrength() {
  const [password, setPassword] = useState('');
  const [strength, setStrength] = useState(null);
  const [criteria, setCriteria] = useState([]);
  const [aiResult, setAiResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
    if (!isAuthenticated) { navigate('/login'); }
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
      { label: 'Contains special character (!@#$%^&*)', passed: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd) },
      { label: 'Not a common password', passed: !['123456', 'password', 'qwerty', '123456789', '12345678', '111111', '1234567', 'sunshine', 'iloveyou', 'princess'].includes(pwd.toLowerCase()) },
    ];

    setCriteria(checks);

    const passedCount = checks.filter(c => c.passed).length;
    let level = 'Very Weak';
    let color = '#ef5350';
    let percent = 10;

    if (passedCount >= 7) { level = 'Very Strong'; color = '#4caf50'; percent = 100; }
    else if (passedCount >= 5) { level = 'Strong'; color = '#66bb6a'; percent = 75; }
    else if (passedCount >= 4) { level = 'Moderate'; color = '#ff9800'; percent = 50; }
    else if (passedCount >= 2) { level = 'Weak'; color = '#ff5722'; percent = 30; }

    setStrength({ level, color, percent });
  };

  const handleChange = (e) => {
    const val = e.target.value;
    setPassword(val);
    analyzePassword(val);
    setAiResult(null);
  };

  const handleAiCheck = async () => {
    if (!password) return;
    setLoading(true);
    setAiResult(null);
    try {
      const response = await axios.post('http://localhost:8000/password/analyze/', {
        password: password,
      }, { withCredentials: true });

      if (response.data.success) {
        setAiResult(response.data);
      } else {
        setAiResult({ error: response.data.detail || 'Analysis failed' });
      }
    } catch (err) {
      setAiResult({ error: err.response?.data?.detail || 'Server error. AI model could not be reached.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="password-layout">
        <div className="password-header">
          <div className="header-icon-wrapper">🔑</div>
          <div>
            <h1>Password Strength Analysis</h1>
            <p>AI-powered password security assessment. Detect and improve your weak passwords.</p>
          </div>
        </div>

        <div className="password-content">
          <div className="password-card main-card">
            <h2>Test Your Password</h2>
            <div className="password-input-group">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={handleChange}
                placeholder="Type a password to test..."
                className="password-test-input"
                autoFocus
              />
              <button className="toggle-visibility" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>

            {strength && (
              <div className="strength-bar-container">
                <div className="strength-bar">
                  <div
                    className="strength-bar-fill"
                    style={{ width: `${strength.percent}%`, backgroundColor: strength.color }}
                  />
                </div>
                <div className="strength-label" style={{ color: strength.color }}>
                  {strength.level} ({strength.percent}%)
                </div>
              </div>
            )}

            {criteria.length > 0 && (
              <div className="criteria-list">
                <h3>Security Criteria</h3>
                {criteria.map((c, i) => (
                  <div key={i} className={`criteria-item ${c.passed ? 'passed' : 'failed'}`}>
                    <span className="criteria-icon">{c.passed ? '✅' : '❌'}</span>
                    <span>{c.label}</span>
                  </div>
                ))}
              </div>
            )}

            {password && (
              <button className="ai-check-btn" onClick={handleAiCheck} disabled={loading}>
                {loading ? '🤖 AI Analyzing...' : '🤖 Run AI Assessment'}
              </button>
            )}

            {aiResult && (
              <div className={`ai-result-card ${aiResult.error ? 'error' : ''}`}>
                <h3>🧠 AI Assessment Result</h3>
                {aiResult.error ? (
                  <p className="ai-error">{aiResult.error}</p>
                ) : (
                  <>
                    <div className="ai-prediction">
                      <strong>Prediction:</strong> <span style={{ color: aiResult.prediction === 'Strong' ? '#4caf50' : '#ef5350' }}>{aiResult.prediction}</span>
                    </div>
                    {aiResult.suggestions && aiResult.suggestions.length > 0 && (
                      <div className="ai-suggestions">
                        <strong>Suggestions:</strong>
                        <ul>
                          {aiResult.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="password-card tips-card">
            <h3>💡 Strong Password Tips</h3>
            <ul className="tips-list">
              <li>Use at least 12 characters (longer is more secure)</li>
              <li>Mix uppercase, lowercase, numbers and symbols</li>
              <li>Avoid personal information (name, birthdate, etc.)</li>
              <li>Don't use common dictionary words</li>
              <li>Create a unique password for each account</li>
              <li>Consider using a password manager</li>
              <li>Enable two-factor authentication (MFA) for extra security</li>
            </ul>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
