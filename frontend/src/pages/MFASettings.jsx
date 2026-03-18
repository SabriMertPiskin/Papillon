import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { mfaSetup, mfaVerifySetup, mfaDisable, mfaStatus } from '../services/api';
import DashboardLayout from '../components/DashboardLayout';
import '../styles/MFASettings.css';

const IconShield = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
  </svg>
);

const IconCheck = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

const IconAlert = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="12" y1="8" x2="12" y2="12"></line>
    <line x1="12" y1="16" x2="12.01" y2="16"></line>
  </svg>
);

const IconKey = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
  </svg>
);

export default function MFASettings() {
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [setupData, setSetupData] = useState(null);
  const [otpCode, setOtpCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [step, setStep] = useState('idle');
  const navigate = useNavigate();

  useEffect(() => {
    const theme = localStorage.getItem('papillon-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    fetchMfaStatus();
  }, [navigate]);

  const fetchMfaStatus = async () => {
    try {
      const response = await mfaStatus();
      if (response.data.success) {
        setMfaEnabled(response.data.mfa_enabled);
      }
    } catch (error) {
      if (error.response?.status === 401) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStartSetup = async () => {
    setMessage({ type: '', text: '' });
    setStep('setup');
    setLoading(true);
    try {
      const response = await mfaSetup();
      if (response.data.success) {
        setSetupData({
          qr_code: response.data.qr_code,
          secret: response.data.secret,
        });
        setStep('verify');
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.detail || 'MFA setup could not be initiated due to a communication error.' });
      setStep('idle');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySetup = async (e) => {
    e.preventDefault();
    if (!otpCode || otpCode.length !== 6) {
      setMessage({ type: 'error', text: 'Please enter the complete 6-digit verification code.' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await mfaVerifySetup(otpCode);
      if (response.data.success) {
        setMfaEnabled(true);
        setSetupData(null);
        setOtpCode('');
        setBackupCode(response.data.backup_code || '');
        setStep('backup');
        setMessage({ type: 'success', text: 'MFA has been successfully configured and activated.' });
        
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        user.mfa_enabled = true;
        localStorage.setItem('user', JSON.stringify(user));
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.detail || 'The code you entered is incorrect or expired. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async (e) => {
    e.preventDefault();
    if (!disablePassword) {
      setMessage({ type: 'error', text: 'You must enter your current password to proceed.' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await mfaDisable(disablePassword);
      if (response.data.success) {
        setMfaEnabled(false);
        setDisablePassword('');
        setStep('idle');
        setMessage({ type: 'success', text: 'MFA protection has been removed from your account.' });
        
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        user.mfa_enabled = false;
        localStorage.setItem('user', JSON.stringify(user));
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.detail || 'Password could not be verified. Please check and try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="mfa-layout">
        <div className="mfa-card">
          <div className="mfa-header">
            <div className="mfa-title-group">
              <div className="mfa-icon">
                <IconShield />
              </div>
              <div>
                <h2>Two-Factor Authentication (MFA)</h2>
                <div className={`mfa-status-badge ${mfaEnabled ? 'enabled' : 'disabled'}`}>
                  {mfaEnabled ? <><IconCheck /> MFA Active Protection</> : <><IconAlert /> MFA Disabled</>}
                </div>
              </div>
            </div>
          </div>

          {message.text && (
            <div className={`mfa-message ${message.type}`}>
              {message.type === 'success' ? <IconCheck /> : <IconAlert />}
              {message.text}
            </div>
          )}

          {loading && step === 'idle' ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--auth-text-muted)' }}>
              Synchronizing with authentication server...
            </div>
          ) : (
            <>
              {/* MFA Disabled — Enable */}
              {!mfaEnabled && step === 'idle' && (
                <div className="fade-in">
                  <p className="mfa-description">
                    Two-factor authentication (2FA/MFA) is a vital security layer that protects your account against unauthorized access even if your password is stolen. After pairing, you will need to enter a dynamic password generated by Google Authenticator or a similar TOTP application to log in.
                  </p>
                  <button className="mfa-btn enable" onClick={handleStartSetup}>
                    <IconKey /> Start Security Setup
                  </button>
                </div>
              )}

              {/* QR Code + Verification Step */}
              {!mfaEnabled && step === 'verify' && setupData && (
                <div className="fade-in">
                  <div className="setup-step">
                    <div className="step-number">1</div>
                    <p>Install and open Google Authenticator (or a compatible TOTP app).</p>
                  </div>
                  
                  <div className="setup-step">
                    <div className="step-number">2</div>
                    <p>Scan the QR code below to configure your profile.</p>
                  </div>

                  <div className="qr-section">
                    <img src={setupData.qr_code} alt="MFA Verification QR Code" className="qr-image" />
                    <div className="manual-key">
                      <p>If your camera has trouble scanning, you can enter this secret key manually:</p>
                      <code>{setupData.secret}</code>
                    </div>
                  </div>

                  <div className="setup-step">
                    <div className="step-number">3</div>
                    <p>Enter the 6-digit code generated by your paired device below for verification.</p>
                  </div>

                  <form onSubmit={handleVerifySetup}>
                    <div className="otp-input-group">
                      <input
                        type="text"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="······"
                        maxLength={6}
                        className="otp-input"
                        autoFocus
                      />
                      <button type="submit" className="mfa-btn verify" disabled={loading || otpCode.length !== 6}>
                        {loading ? 'Syncing...' : 'Complete Pairing'}
                      </button>
                    </div>
                  </form>

                  <div style={{marginTop: '20px', textAlign: 'center'}}>
                    <button type="button" className="mfa-btn cancel" onClick={() => { setStep('idle'); setSetupData(null); setOtpCode(''); setMessage({type:'', text:''}); }} style={{width: 'auto', display: 'inline-block', padding: '10px 20px', fontSize: '0.9rem'}}>
                      Cancel Setup
                    </button>
                  </div>
                </div>
              )}

              {/* MFA Active — Backup Code Display (after initial setup) */}
              {mfaEnabled && step === 'backup' && backupCode && (
                <div className="backup-code-box fade-in">
                  <h3><IconAlert /> Emergency Backup Code</h3>
                  <p style={{ color: '#fbc02d', margin: '0 0 16px 0', fontSize: '0.95rem' }}>
                    This code is the only way to log into your account if you lose access to your device or Authenticator app. Please write this down on paper and store it in a safe place.
                  </p>
                  <div className="backup-code-display">
                    <code>{backupCode}</code>
                  </div>
                  <p className="mfa-warning-text" style={{marginTop: '16px'}}>
                    <IconAlert /> This recovery code will NOT BE SHOWN ON SCREEN AGAIN!
                  </p>
                  
                  <button className="mfa-btn enable" style={{marginTop: '24px'}} onClick={() => { setStep('idle'); setBackupCode(''); }}>
                    I've Saved It, Continue
                  </button>
                </div>
              )}

              {/* MFA Active — Disable Menu */}
              {mfaEnabled && step === 'idle' && (
                <div className="fade-in">
                  <p className="mfa-description">
                    Your account is protected with an active TOTP (Time-based One-Time Password) shield against unauthorized login attempts. To change or completely disable protection settings, you must confirm the operation with your password.
                  </p>
                  <button className="mfa-btn disable" onClick={() => setStep('disable')}>
                    Disable MFA Protection...
                  </button>
                </div>
              )}

              {/* Disable Confirmation */}
              {mfaEnabled && step === 'disable' && (
                <div className="fade-in">
                  <div className="mfa-warning-text">
                    <IconAlert /> WARNING: Disabling MFA will create a significant vulnerability in your account against unauthorized access.
                  </div>
                  
                  <form onSubmit={handleDisable}>
                    <div className="form-group">
                      <label>Identity Verification (Your Account Password)</label>
                      <input
                        type="password"
                        value={disablePassword}
                        onChange={(e) => setDisablePassword(e.target.value)}
                        placeholder="Enter your current password..."
                        className="standard-input"
                        autoFocus
                      />
                    </div>
                    
                    <div className="btn-group">
                      <button type="submit" className="mfa-btn disable" disabled={loading || !disablePassword}>
                        {loading ? 'Processing...' : 'Remove Protection'}
                      </button>
                      <button type="button" className="mfa-btn cancel" onClick={() => { setStep('idle'); setDisablePassword(''); setMessage({type:'', text:''}); }}>
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
