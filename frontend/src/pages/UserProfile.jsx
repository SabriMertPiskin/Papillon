import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
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
    }
  }, [navigate]);

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
      const response = await axios.post('http://localhost:8000/user/change-password', {
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
      const response = await axios.post('http://localhost:8000/user/update-domain', {
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

  if (!user) return null;

  return (
    <DashboardLayout>
      <div className="profile-layout">
        <div className="profile-header">
          <div className="header-icon-wrapper">👤</div>
          <div>
            <h1>Profile & Account</h1>
            <p>View your account information, change password, and update domain settings</p>
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
                <div className="info-value">{user.domain || 'Not specified'}</div>
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
              <button type="submit" className="profile-btn" disabled={loading}>
                {loading ? 'Saving...' : 'Save Domain'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
