import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { mfaSetup, mfaVerifySetup, mfaDisable, mfaStatus } from '../services/api';
import DashboardLayout from '../components/DashboardLayout';
import '../styles/UserProfile.css';

export default function UserProfile() {
  const [user, setUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // MFA-related states
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaSetupData, setMfaSetupData] = useState(null);
  const [mfaOtpCode, setMfaOtpCode] = useState('');
  const [mfaDisablePassword, setMfaDisablePassword] = useState('');
  const [mfaBackupCode, setMfaBackupCode] = useState('');
  const [mfaStep, setMfaStep] = useState('idle');
  const [mfaMessage, setMfaMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    const theme = localStorage.getItem('papillon-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    const userData = localStorage.getItem('user');
    if (!userData) {
      navigate('/login');
    } else {
      const parsed = JSON.parse(userData);
      setUser(parsed);
      setNewDomain(parsed.domain || '');
      fetchMfaStatus();
    }
  }, [navigate]);

  const fetchMfaStatus = async () => {
    try {
      const response = await mfaStatus();
      if (response.data.success) {
        setMfaEnabled(response.data.mfa_enabled);
      }
    } catch (error) {
      console.error('Error fetching MFA status:', error);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (!currentPassword) {
      setMessage({ type: 'error', text: 'Current password is required.' });
      return;
    }
    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: 'New password must be at least 8 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post('http://localhost:8000/auth/change-password/', {
        current_password: currentPassword,
        new_password: newPassword
      }, { withCredentials: true });

      if (response.data.success) {
        setMessage({ type: 'success', text: 'Password changed successfully.' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setMessage({ type: 'error', text: response.data.detail || 'Password could not be changed.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Server error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDomainUpdate = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    setLoading(true);

    try {
      const response = await axios.post('http://localhost:8000/auth/update-domain/', {
        domain: newDomain.trim()
      }, { withCredentials: true });

      if (response.data.success) {
        const updatedUser = { ...user, domain: newDomain.trim() };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setMessage({ type: 'success', text: 'Domain information updated.' });
      } else {
        setMessage({ type: 'error', text: response.data.detail || 'Domain could not be updated.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Server error.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDomainRemove = async () => {
    if (!window.confirm('Do you want to remove your saved domain?')) return;

    setMessage({ type: '', text: '' });
    setLoading(true);

    try {
      const response = await axios.post('http://localhost:8000/auth/update-domain/', {
        domain: ''
      }, { withCredentials: true });

      if (response.data.success) {
        const updatedUser = { ...user, domain: '' };
        setUser(updatedUser);
        setNewDomain('');
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setMessage({ type: 'success', text: 'Domain removed successfully.' });
      } else {
        setMessage({ type: 'error', text: response.data.detail || 'Domain could not be removed.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Server error.' });
    } finally {
      setLoading(false);
    }
  };

  // ============ MFA HANDLERS ============
  const handleMfaStartSetup = async () => {
    setMfaMessage({ type: '', text: '' });
    setMfaStep('setup');
    setLoading(true);
    try {
      const response = await mfaSetup();
      if (response.data.success) {
        setMfaSetupData({
          qr_code: response.data.qr_code,
          secret: response.data.secret,
        });
        setMfaStep('verify');
      }
    } catch (error) {
      setMfaMessage({ type: 'error', text: error.response?.data?.detail || 'MFA setup could not be initiated.' });
      setMfaStep('idle');
    } finally {
      setLoading(false);
    }
  };

  const handleMfaVerifySetup = async (e) => {
    e.preventDefault();
    if (!mfaOtpCode || mfaOtpCode.length !== 6) {
      setMfaMessage({ type: 'error', text: 'Please enter the complete 6-digit code.' });
      return;
    }

    setLoading(true);
    setMfaMessage({ type: '', text: '' });
    try {
      const response = await mfaVerifySetup(mfaOtpCode);
      if (response.data.success) {
        setMfaEnabled(true);
        setMfaSetupData(null);
        setMfaOtpCode('');
        setMfaBackupCode(response.data.backup_code || '');
        setMfaStep('backup');
        setMfaMessage({ type: 'success', text: 'MFA has been successfully configured!' });
        
        const updatedUser = { ...user, mfa_enabled: true };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }
    } catch (error) {
      setMfaMessage({ type: 'error', text: error.response?.data?.detail || 'Invalid code.' });
    } finally {
      setLoading(false);
    }
  };

  const handleMfaDisable = async (e) => {
    e.preventDefault();
    if (!mfaDisablePassword) {
      setMfaMessage({ type: 'error', text: 'Password is required.' });
      return;
    }

    setLoading(true);
    setMfaMessage({ type: '', text: '' });
    try {
      const response = await mfaDisable(mfaDisablePassword);
      if (response.data.success) {
        setMfaEnabled(false);
        setMfaDisablePassword('');
        setMfaStep('idle');
        setMfaMessage({ type: 'success', text: 'MFA protection has been removed.' });
        
        const updatedUser = { ...user, mfa_enabled: false };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }
    } catch (error) {
      setMfaMessage({ type: 'error', text: error.response?.data?.detail || 'Could not verify password.' });
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <DashboardLayout>
      <div className="profile-layout">
        <div className="profile-header">
          <div className="header-icon-wrapper">👤</div>
          <div>
            <h1>Profile & Account</h1>
            <p>View your account information, change password, manage domain settings, and configure MFA security</p>
          </div>
        </div>

        {message.text && (
          <div className={`profile-alert ${message.type}`}>
            {message.type === 'success' ? '✅' : '⚠️'} {message.text}
          </div>
        )}

        <div className="profile-content">
          {/* User Info Card */}
          <div className="profile-card info-card">
            <h2>Account Information</h2>
            <div className="info-grid">
              <div className="info-item">
                <label>Username</label>
                <div className="info-value">{user.username}</div>
              </div>
              <div className="info-item">
                <label>Email Address</label>
                <div className="info-value">{user.email}</div>
              </div>
              <div className="info-item">
                <label>Corporate Domain</label>
                <div className="info-value">
                  {user.domain ? (
                    <span className="domain-badge set">{user.domain}</span>
                  ) : (
                    <span className="domain-badge unset">Not specified</span>
                  )}
                </div>
              </div>
              <div className="info-item">
                <label>Outlook Status</label>
                <div className="info-value">
                  <span className={`status-badge ${user.outlook_connected ? 'connected' : 'disconnected'}`}>
                    {user.outlook_connected ? '🔗 Connected' : '○ Disconnected'}
                  </span>
                </div>
              </div>
              <div className="info-item">
                <label>MFA Status</label>
                <div className="info-value">
                  <span className={`mfa-badge ${user.mfa_enabled ? 'active' : 'inactive'}`}>
                    {user.mfa_enabled ? '🛡️ Active' : '⚠️ Inactive'}
                  </span>
                </div>
              </div>
              <div className="info-item">
                <label>Registration Date</label>
                <div className="info-value">
                  {user.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Unknown'}
                </div>
              </div>
            </div>
          </div>

          {/* Password Change Card */}
          <div className="profile-card">
            <h2>Change Password</h2>
            <form onSubmit={handlePasswordChange} className="profile-form">
              <div className="form-group">
                <label>Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter your current password"
                />
              </div>
              <div className="form-group">
                <label>New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                />
              </div>
              <div className="form-group">
                <label>Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your new password"
                />
              </div>
              <button type="submit" className="profile-btn" disabled={loading}>
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </div>

          {/* Domain Update Card */}
          <div className="profile-card">
            <h2>Update Domain</h2>
            <form onSubmit={handleDomainUpdate} className="profile-form">
              <div className="form-group">
                <label>Corporate Domain</label>
                <input
                  type="text"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  placeholder="e.g., company.com"
                />
              </div>
              <div className="profile-btn-row">
                <button type="submit" className="profile-btn" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Domain'}
                </button>
                <button
                  type="button"
                  className="profile-btn danger"
                  disabled={loading || !user.domain}
                  onClick={handleDomainRemove}
                >
                  {loading ? 'Processing...' : 'Remove Domain'}
                </button>
              </div>
            </form>
          </div>

          {/* MFA Settings Card */}
          <div className="profile-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--auth-glass-border)' }}>
              <h2 style={{ margin: 0 }}>Two-Factor Authentication</h2>
              <div className={`mfa-status-badge ${mfaEnabled ? 'enabled' : 'disabled'}`}>
                {mfaEnabled ? '✓ Active' : '○ Inactive'}
              </div>
            </div>

            {mfaMessage.text && (
              <div className={`profile-alert ${mfaMessage.type}`}>
                {mfaMessage.type === 'success' ? '✅' : '⚠️'} {mfaMessage.text}
              </div>
            )}

            {/* MFA Setup State */}
            {!mfaEnabled && mfaStep === 'idle' && (
              <form onSubmit={(e) => { e.preventDefault(); handleMfaStartSetup(); }} className="profile-form">
                <p style={{ fontSize: '0.95rem', lineHeight: '1.6', color: 'var(--auth-text-secondary)', marginBottom: '20px' }}>
                  Two-factor authentication adds an extra security layer to your account. You'll need a code from Google Authenticator or similar app to log in.
                </p>
                <button type="submit" className="profile-btn" disabled={loading}>
                  {loading ? 'Initializing...' : 'Enable MFA Security'}
                </button>
              </form>
            )}

            {/* MFA Verification Step */}
            {!mfaEnabled && mfaStep === 'verify' && mfaSetupData && (
              <form onSubmit={handleMfaVerifySetup} className="profile-form fade-in">
                <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px dashed var(--auth-subtle-border)', padding: '20px', borderRadius: '12px', marginBottom: '20px', textAlign: 'center' }}>
                  <p style={{ fontSize: '0.9rem', color: 'var(--auth-text-secondary)', marginBottom: '12px' }}>
                    Scan the QR code with Google Authenticator or compatible TOTP app:
                  </p>
                  <img src={mfaSetupData.qr_code} alt="QR Code" style={{ maxWidth: '140px', background: '#fff', padding: '10px', borderRadius: '10px', marginBottom: '12px' }} />
                  <p style={{ fontSize: '0.8rem', color: 'var(--auth-text-muted)', marginBottom: '6px', margin: '16px 0 6px 0' }}>Manual key (if camera fails):</p>
                  <code style={{ display: 'inline-block', background: 'var(--auth-card-inset)', color: 'var(--auth-teal)', padding: '8px 12px', borderRadius: '6px', fontFamily: "'Fira Code', monospace", fontSize: '0.85rem', letterSpacing: '1px', border: '1px solid rgba(0, 188, 212, 0.2)' }}>
                    {mfaSetupData.secret}
                  </code>
                </div>
                
                <div className="form-group">
                  <label>6-Digit Verification Code</label>
                  <input
                    type="text"
                    value={mfaOtpCode}
                    onChange={(e) => setMfaOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    autoFocus
                    style={{ textAlign: 'center', fontSize: '1.2rem', letterSpacing: '4px' }}
                  />
                </div>
                
                <div className="profile-btn-row">
                  <button type="submit" className="profile-btn" disabled={loading || mfaOtpCode.length !== 6}>
                    {loading ? 'Verifying...' : 'Complete Setup'}
                  </button>
                  <button 
                    type="button" 
                    className="profile-btn"
                    style={{ background: 'transparent', border: '1px solid var(--auth-glass-border)', color: 'var(--auth-text-secondary)' }}
                    onClick={() => { setMfaStep('idle'); setMfaSetupData(null); setMfaOtpCode(''); }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* Backup Code Display */}
            {mfaEnabled && mfaStep === 'backup' && mfaBackupCode && (
              <div className="profile-form fade-in">
                <div style={{ background: 'rgba(251, 192, 45, 0.12)', border: '1px solid rgba(251, 192, 45, 0.3)', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
                  <p style={{ margin: '0 0 8px 0', fontWeight: '700', color: '#fbc02d' }}>⚠️ Emergency Backup Code</p>
                  <p style={{ margin: '0', fontSize: '0.85rem', color: 'var(--auth-text-secondary)' }}>
                    Save this code in a safe place. It's your only recovery option if you lose access to your authenticator.
                  </p>
                </div>
                
                <div style={{ background: 'var(--auth-card-inset)', border: '2px dashed rgba(251, 192, 45, 0.4)', borderRadius: '12px', padding: '20px', textAlign: 'center', marginBottom: '16px' }}>
                  <code style={{ fontSize: '1.4rem', fontWeight: '800', letterSpacing: '2px', color: '#fbc02d', fontFamily: "'Fira Code', monospace" }}>
                    {mfaBackupCode}
                  </code>
                </div>

                <p style={{ fontSize: '0.85rem', color: '#ef5350', marginBottom: '20px' }}>⚠️ This code will NOT be shown again!</p>
                
                <button 
                  className="profile-btn"
                  onClick={() => { setMfaStep('idle'); setMfaBackupCode(''); }}
                >
                  I've Saved It
                </button>
              </div>
            )}

            {/* MFA Active / Disable Option */}
            {mfaEnabled && mfaStep === 'idle' && (
              <form onSubmit={(e) => { e.preventDefault(); setMfaStep('disable'); }} className="profile-form">
                <p style={{ fontSize: '0.95rem', lineHeight: '1.6', color: 'var(--auth-text-secondary)', marginBottom: '20px' }}>
                  Your account is protected with two-factor authentication. You must verify with your authenticator app when logging in.
                </p>
                <button type="submit" className="profile-btn danger" disabled={loading}>
                  Disable MFA Protection
                </button>
              </form>
            )}

            {/* Disable Confirmation */}
            {mfaEnabled && mfaStep === 'disable' && (
              <form onSubmit={handleMfaDisable} className="profile-form fade-in">
                <div style={{ background: 'rgba(244, 67, 54, 0.12)', border: '1px solid rgba(244, 67, 54, 0.3)', borderRadius: '10px', padding: '16px', marginBottom: '20px', color: '#ef5350', fontWeight: '600' }}>
                  ⚠️ WARNING: Disabling MFA will remove an important security layer from your account.
                </div>

                <div className="form-group">
                  <label>Confirm with Your Password</label>
                  <input
                    type="password"
                    value={mfaDisablePassword}
                    onChange={(e) => setMfaDisablePassword(e.target.value)}
                    placeholder="Enter your password..."
                    autoFocus
                  />
                </div>

                <div className="profile-btn-row">
                  <button type="submit" className="profile-btn danger" disabled={loading || !mfaDisablePassword}>
                    {loading ? 'Processing...' : 'Remove Protection'}
                  </button>
                  <button 
                    type="button" 
                    className="profile-btn"
                    style={{ background: 'transparent', border: '1px solid var(--auth-glass-border)', color: 'var(--auth-text-secondary)' }}
                    onClick={() => { setMfaStep('idle'); setMfaDisablePassword(''); }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
