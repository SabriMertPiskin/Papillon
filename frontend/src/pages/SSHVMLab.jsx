import React, { useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { sshVmLabDownloadKey, sshVmLabStartInstance } from '../services/api';
import { canManageVM } from '../utils/roleUtils';
import '../styles/SSHVMLab.css';

const extractIp = (payload) => {
  if (!payload) return '';
  const ip = payload.public_ip || payload.ip || payload?.data?.public_ip;
  return typeof ip === 'string' ? ip.trim() : '';
};

export default function SSHVMLab() {
  const [publicIp, setPublicIp] = useState('');
  const [rawResponse, setRawResponse] = useState(null);
  const [loadingStart, setLoadingStart] = useState(false);
  const [loadingKey, setLoadingKey] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const hasAccess = canManageVM();

  const handleStartInstance = async () => {
    setLoadingStart(true);
    setMessage({ type: '', text: '' });
    setCopySuccess(false);

    try {
      const response = await sshVmLabStartInstance();
      const payload = response.data?.data || null;
      const ip = extractIp(payload);

      setRawResponse(payload);
      setPublicIp(ip);

      if (!ip) {
        setMessage({
          type: 'error',
          text: 'Instance started but no public IP was returned yet. Please try again in a few seconds.',
        });
        return;
      }

      setMessage({ type: 'success', text: 'Instance started successfully. Public IP is ready.' });
    } catch (err) {
      setPublicIp('');
      setRawResponse(null);
      setMessage({
        type: 'error',
        text: err.response?.data?.detail || err.response?.data?.error || 'Could not start the instance.',
      });
    } finally {
      setLoadingStart(false);
    }
  };

  const handleCopyIp = async () => {
    if (!publicIp) return;
    try {
      await navigator.clipboard.writeText(publicIp);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 1500);
    } catch (_err) {
      setMessage({ type: 'error', text: 'Could not copy IP to clipboard.' });
    }
  };

  const handleDownloadPem = async () => {
    setLoadingKey(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await sshVmLabDownloadKey();
      const blob = new Blob([response.data], { type: 'application/x-pem-file' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = 'awskey.pem';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      setMessage({ type: 'success', text: 'awskey.pem downloaded.' });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Could not download awskey.pem.',
      });
    } finally {
      setLoadingKey(false);
    }
  };

  if (!hasAccess) {
    return (
      <DashboardLayout>
        <div className="ssh-vm-page">
          <div className="ssh-vm-alert error">
            <strong>Access Denied</strong><br />
            Only Security Analysts and Administrators can access SSH VM Lab.
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="ssh-vm-page">
        <div className="ssh-vm-header">
          <h1>SSH VM Lab</h1>
          <p>
            Start an AWS instance, get the public IP, and download your <strong>awskey.pem</strong> for SSH connection.
          </p>
        </div>

        {message.text && <div className={`ssh-vm-alert ${message.type}`}>{message.text}</div>}

        <div className="ssh-vm-card">
          <div className="ssh-vm-actions">
            <button className="ssh-vm-btn primary" onClick={handleStartInstance} disabled={loadingStart || loadingKey}>
              {loadingStart ? 'Starting...' : 'Start AWS Instance'}
            </button>
            <button className="ssh-vm-btn secondary" onClick={handleDownloadPem} disabled={loadingStart || loadingKey}>
              {loadingKey ? 'Downloading...' : 'Download awskey.pem'}
            </button>
          </div>

          <div className="ssh-vm-ip-box">
            <label>Returned Public IP</label>
            <div className="ssh-vm-ip-row">
              <input type="text" readOnly value={publicIp || 'No IP yet'} />
              <button className="ssh-vm-btn copy" onClick={handleCopyIp} disabled={!publicIp}>
                {copySuccess ? 'Copied' : 'Copy IP'}
              </button>
            </div>
          </div>

          {rawResponse && (
            <div className="ssh-vm-meta">
              <div><strong>Instance ID:</strong> {rawResponse.instance_id || '-'}</div>
              <div><strong>Status:</strong> {rawResponse.status || '-'}</div>
            </div>
          )}

          {publicIp && (
            <div className="ssh-vm-instruction">
              <label>SSH Connection Command</label>
              <div className="ssh-vm-cmd-row">
                <code className="ssh-vm-cmd">ssh -i awskey.pem ec2-user@{publicIp}</code>
                <button
                  className="ssh-vm-btn copy"
                  onClick={() => {
                    navigator.clipboard.writeText(`ssh -i awskey.pem ec2-user@${publicIp}`);
                    setCopySuccess(true);
                    setTimeout(() => setCopySuccess(false), 1500);
                  }}
                >
                  {copySuccess ? 'Copied' : 'Copy Cmd'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
