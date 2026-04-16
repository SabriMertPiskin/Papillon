import React, { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { vmLabStatus, vmLabStart, vmLabTerminate, resolveAnalystVmLabPath } from '../services/api';
import { canManageVM } from '../utils/roleUtils';
import '../styles/VMLab.css';

const formatDateTime = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('tr-TR');
};

export default function VMLab() {
  const [machine, setMachine] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [analystInput, setAnalystInput] = useState('');
  const [selectedAnalyst, setSelectedAnalyst] = useState('');
  const [selectedAnalystDomain, setSelectedAnalystDomain] = useState('');
  const [selectorLoading, setSelectorLoading] = useState(false);
  const [selectorMessage, setSelectorMessage] = useState({ type: '', text: '' });

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdminUser = currentUser?.role === 'admin';
  const isAnalystUser = currentUser?.role === 'analyst';
  const currentVmLabPath = (currentUser?.vm_lab_path || '').trim();
  const missingOwnVmLabPath = isAnalystUser && !currentVmLabPath;

  const refreshStatus = async (targetAnalyst = selectedAnalyst) => {
    if (isAdminUser && !targetAnalyst) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await vmLabStatus(targetAnalyst || null);
      if (response.data.success) {
        setMachine(response.data.machine);
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Could not fetch machine status.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (missingOwnVmLabPath) {
      setLoading(false);
      return;
    }

    if (!isAdminUser) {
      refreshStatus();
    } else {
      setLoading(false);
    }
  }, [isAdminUser, missingOwnVmLabPath, selectedAnalyst]);

  const handleApplyAnalyst = async () => {
    const username = analystInput.trim();
    if (!username) {
      setSelectorMessage({ type: 'error', text: 'Please enter an analyst username.' });
      return;
    }

    setSelectorLoading(true);
    setSelectorMessage({ type: '', text: '' });

    try {
      const response = await resolveAnalystVmLabPath(username);
      if (!response.data.success) {
        setSelectorMessage({ type: 'error', text: response.data.detail || 'Could not validate analyst.' });
        return;
      }

      const resolvedUsername = response.data.analyst_username || username;
      const resolvedDomain = response.data.domain || '';
      const resolvedVmLabPath = (response.data.vm_lab_path || '').trim();

      if (!resolvedVmLabPath) {
        setSelectedAnalyst('');
        setSelectedAnalystDomain('');
        setMachine(null);
        setSelectorMessage({
          type: 'error',
          text: `Analyst "${resolvedUsername}" has no configured VM Lab path. Add it in Profile & Account first.`,
        });
        return;
      }

      setSelectedAnalyst(resolvedUsername);
      setSelectedAnalystDomain(resolvedDomain);
      setSelectorMessage({ type: 'success', text: `Analyst selected: ${resolvedUsername} (${resolvedDomain})` });
      setMessage({ type: '', text: '' });
      await refreshStatus(resolvedUsername);
    } catch (err) {
      setSelectedAnalyst('');
      setSelectedAnalystDomain('');
      setMachine(null);
      setSelectorMessage({ type: 'error', text: err.response?.data?.detail || 'Could not validate analyst.' });
    } finally {
      setSelectorLoading(false);
    }
  };

  const handleStart = async () => {
    setActionLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await vmLabStart(isAdminUser ? selectedAnalyst : null);
      if (response.data.success) {
        setMachine(response.data.machine);
        setMessage({ type: 'success', text: response.data.detail || 'Machine started.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Machine start failed.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleTerminate = async () => {
    setActionLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await vmLabTerminate(isAdminUser ? selectedAnalyst : null);
      if (response.data.success) {
        setMachine(response.data.machine);
        setMessage({ type: 'success', text: response.data.detail || 'Machine terminated.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Machine terminate failed.' });
    } finally {
      setActionLoading(false);
    }
  };

  const isRunning = Boolean(machine?.running);
  const vmIpAddress = machine?.connection?.ip || machine?.connection?.host || '-';
  const hasAccess = canManageVM();

  if (!hasAccess) {
    return (
      <DashboardLayout>
        <div className="vm-layout">
          <div className="vm-header">
            <div className="vm-header-title-group">
              <div className="vm-header-icon">🖥️</div>
              <div className="vm-header-title">
                <h1>VM Attack Lab</h1>
                <p>TryHackMe-style lab skeleton. Start a machine and run attack simulation workflows.</p>
              </div>
            </div>
          </div>
          <div className="vm-alert error">
            <strong>Access Denied</strong><br />
            Only Security Analysts and Administrators can use the VM Lab feature.
            Please contact your administrator if you need access.
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (missingOwnVmLabPath) {
    return (
      <DashboardLayout>
        <div className="vm-layout">
          <div className="vm-header">
            <div className="vm-header-title-group">
              <div className="vm-header-icon">🖥️</div>
              <div className="vm-header-title">
                <h1>VM Attack Lab</h1>
                <p>TryHackMe-style lab skeleton. Start a machine and run attack simulation workflows.</p>
              </div>
            </div>
          </div>
          <div className="vm-alert error">
            <strong>Module Locked</strong><br />
            Please add your VM Lab path in <strong>Profile & Account</strong> before opening this module.
          </div>
          <div className="vm-actions">
            <button className="vm-btn start" onClick={() => { window.location.href = '/profile'; }}>
              Go to Profile & Account
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="vm-layout">
        <div className="vm-header">
          <div className="vm-header-title-group">
            <div className="vm-header-icon">🖥️</div>
            <div className="vm-header-title">
              <h1>VM Attack Lab</h1>
              <p>TryHackMe-style lab skeleton. Start a machine and run attack simulation workflows.</p>
            </div>
          </div>
          <button className="vm-refresh-btn" onClick={() => refreshStatus()} disabled={loading || actionLoading || (isAdminUser && !selectedAnalyst)}>
            {loading ? 'Refreshing...' : 'Refresh Status'}
          </button>
        </div>

        {isAdminUser && (
          <div className="vm-selector-card">
            <label className="vm-selector-label">👤 Monitoring for Analyst:</label>
              <input
                type="text"
                value={analystInput}
                onChange={(e) => setAnalystInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleApplyAnalyst();
                  }
                }}
                placeholder="Enter analyst username (e.g., analyst1)"
                className="vm-selector-input"
              />
              <button
                type="button"
                onClick={handleApplyAnalyst}
                disabled={selectorLoading}
                className="vm-selector-btn"
              >
                {selectorLoading ? '...' : '➜'}
              </button>
            {selectedAnalyst && (
              <div className="vm-selector-meta">
                Using analyst: <strong>{selectedAnalyst}</strong> ({selectedAnalystDomain})
              </div>
            )}
            {selectorMessage.text && (
              <div className={`vm-selector-message ${selectorMessage.type}`}>
                {selectorMessage.text}
              </div>
            )}
          </div>
        )}

        {isAdminUser && !selectedAnalyst && (
          <div className="vm-alert error">
            Enter an analyst username and press the arrow button. If that analyst has no domain, VM Lab access is blocked.
          </div>
        )}

        {message.text && <div className={`vm-alert ${message.type}`}>{message.text}</div>}

        <div className={`vm-card ${isAdminUser && !selectedAnalyst ? 'is-disabled' : ''}`}>
          <div className="vm-status-row">
            <span className={`vm-chip ${isRunning ? 'running' : 'stopped'}`}>
              {isRunning ? '● Running' : '○ Stopped'}
            </span>
            <span className="vm-meta">Machine ID: {machine?.machine_id || '-'}</span>
          </div>

          <div className="vm-grid">
            <div className="vm-field">
              <label>Started At</label>
              <div>{formatDateTime(machine?.started_at)}</div>
            </div>
            <div className="vm-field">
              <label>Connection</label>
              <div>
                {machine?.connection
                  ? `${machine.connection.protocol}://${machine.connection.host}:${machine.connection.port}`
                  : '-'}
              </div>
            </div>
            <div className="vm-field">
              <label>Details</label>
              <div>{machine?.detail || 'Machine is not running.'}</div>
              <div style={{ marginTop: '8px', fontSize: '0.9rem', color: 'var(--auth-text-secondary)' }}>
                VM IP: <strong>{vmIpAddress}</strong>
              </div>
            </div>
          </div>

          <div className="vm-actions">
            {!isRunning ? (
              <button className="vm-btn start" onClick={handleStart} disabled={actionLoading || loading}>
                {actionLoading ? 'Starting...' : 'Start Machine'}
              </button>
            ) : (
              <button className="vm-btn terminate" onClick={handleTerminate} disabled={actionLoading || loading}>
                {actionLoading ? 'Terminating...' : 'Terminate Machine'}
              </button>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
