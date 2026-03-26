import React, { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { vmLabStatus, vmLabStart, vmLabTerminate } from '../services/api';
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

  const refreshStatus = async () => {
    setLoading(true);
    try {
      const response = await vmLabStatus();
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
    refreshStatus();
  }, []);

  const handleStart = async () => {
    setActionLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await vmLabStart();
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
      const response = await vmLabTerminate();
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

  return (
    <DashboardLayout>
      <div className="vm-page">
        <div className="vm-header">
          <div>
            <h1>🖥️ VM Attack Lab</h1>
            <p>TryHackMe-style lab skeleton. Start a machine and run attack simulation workflows.</p>
          </div>
          <button className="vm-refresh-btn" onClick={refreshStatus} disabled={loading || actionLoading}>
            {loading ? 'Refreshing...' : 'Refresh Status'}
          </button>
        </div>

        {message.text && <div className={`vm-alert ${message.type}`}>{message.text}</div>}

        <div className="vm-card">
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
              <label>Expires At</label>
              <div>{formatDateTime(machine?.expires_at)}</div>
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
