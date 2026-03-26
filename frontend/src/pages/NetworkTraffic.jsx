import React, { useState, useEffect, useRef } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import DashboardLayout from '../components/DashboardLayout';
import { monitorNetworkSnapshot } from '../services/api';
import '../styles/NetworkTraffic.css';

const generateTimeStr = (date) => {
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
};

export default function NetworkTraffic() {
  const [domainAccessAllowed, setDomainAccessAllowed] = useState(true);
  const [monitoredDomain, setMonitoredDomain] = useState('');
  const [isSimulating, setIsSimulating] = useState(false);

  const [trafficData, setTrafficData] = useState([]);
  const [packetsTotal, setPacketsTotal] = useState(0);
  const [bandwidthOut, setBandwidthOut] = useState(0);
  const [activeConnections, setActiveConnections] = useState(0);
  const [anomalyCount, setAnomalyCount] = useState(0);
  const [anomalies, setAnomalies] = useState([]);
  const [activeIPs, setActiveIPs] = useState([]);
  const [aiStatus, setAiStatus] = useState('idle'); // idle, analyzing, connected, error

  const intervalRef = useRef(null);

  const fetchSnapshot = async () => {
    if (!monitoredDomain) return;

    setAiStatus('analyzing');
    try {
      const response = await monitorNetworkSnapshot(monitoredDomain);
      if (!response.data.success || !response.data.snapshot) {
        setAiStatus('error');
        return;
      }

      const snapshot = response.data.snapshot;
      const traffic = snapshot.traffic || {};
      const ai = snapshot.ai || {};
      const now = new Date();

      setTrafficData(prev => {
        const newData = [...prev, {
          time: generateTimeStr(now),
          inbound: Number(traffic.inbound_kbps || 0),
          outbound: Number(traffic.outbound_kbps || 0),
        }];
        if (newData.length > 20) newData.shift();
        return newData;
      });

      setPacketsTotal(Number(traffic.packets_processed || 0));
      setBandwidthOut(Number(traffic.outbound_kbps || 0));
      setActiveConnections(Number(traffic.active_connections || 0));
      setAnomalyCount(Number(ai.threats || 0));

      const normalizedAnomalies = (snapshot.anomalies || []).map((item, idx) => ({
        id: item.id || `${Date.now()}-${idx}`,
        time: generateTimeStr(now),
        type: item.type === 'critical' ? 'critical' : 'warning',
        ip: item.ip || '-',
        desc: item.desc || 'AI detected suspicious traffic.',
      }));

      setAnomalies(prev => [...normalizedAnomalies, ...prev].slice(0, 50));
      setActiveIPs(snapshot.active_ips || []);
      setAiStatus('connected');
    } catch (err) {
      console.error('Domain monitoring snapshot failed:', err);
      setAiStatus('error');
    }
  };

  useEffect(() => {
    const userRaw = localStorage.getItem('user');
    if (!userRaw) {
      setDomainAccessAllowed(false);
      setIsSimulating(false);
      return;
    }

    try {
      const parsedUser = JSON.parse(userRaw);
      const savedDomain = (parsedUser?.domain || '').trim();
      if (!savedDomain) {
        setDomainAccessAllowed(false);
        setIsSimulating(false);
        return;
      }

      setMonitoredDomain(savedDomain);
      setDomainAccessAllowed(true);

      const initData = [];
      const now = new Date();
      for (let i = 20; i >= 0; i--) {
        const pastTime = new Date(now.getTime() - i * 2000);
        initData.push({
          time: generateTimeStr(pastTime),
          inbound: 0,
          outbound: 0,
        });
      }
      setTrafficData(initData);
      setIsSimulating(true);
    } catch (e) {
      setDomainAccessAllowed(false);
      setIsSimulating(false);
    }

    return () => clearInterval(intervalRef.current);
  }, []);

  useEffect(() => {
    if (!domainAccessAllowed || !monitoredDomain) {
      clearInterval(intervalRef.current);
      return;
    }

    if (isSimulating) {
      fetchSnapshot();
      intervalRef.current = setInterval(fetchSnapshot, 4000);
    } else {
      clearInterval(intervalRef.current);
      setAiStatus('idle');
    }

    return () => clearInterval(intervalRef.current);
  }, [isSimulating, monitoredDomain, domainAccessAllowed]);

  if (!domainAccessAllowed) {
    return (
      <DashboardLayout>
        <div className="network-page-container">
          <div className="network-header">
            <div>
              <h1>🌐 Network Traffic & IDS Analysis</h1>
              <p>Real-time attack detection and packet analysis powered by AI (XGBoost IDS Model).</p>
            </div>
          </div>

          <div className="net-panel-card" style={{ maxWidth: '760px', margin: '30px auto' }}>
            <div className="net-panel-header">
              <h2>🔒 Module Access Locked</h2>
            </div>
            <div style={{ padding: '8px 2px', color: 'var(--auth-text-secondary)', lineHeight: 1.7 }}>
              Domain-based monitoring is available after you add your organization domain in Profile & Account.
              Once your domain is saved, this module will become active automatically.
            </div>
            <div style={{ marginTop: '18px' }}>
              <button
                className="net-btn start"
                onClick={() => { window.location.href = '/profile'; }}
              >
                Go to Profile & Account
              </button>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="network-page-container">
        <div className="network-header">
          <div>
            <h1>🌐 Network Traffic & IDS Analysis</h1>
            <p>Monitoring domain traffic with AI intrusion detection: <strong>{monitoredDomain}</strong></p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexShrink: 0 }}>
            <div className={`live-badge ${!isSimulating ? 'stopped' : ''}`}>
              <div className={`live-indicator ${!isSimulating ? 'stopped' : ''}`}></div>
              {isSimulating ? 'SYSTEM ACTIVE' : 'SYSTEM STOPPED'}
            </div>
            <div style={{
                   display: 'flex', alignItems: 'center', gap: '8px',
                   background: aiStatus === 'connected' ? 'rgba(76, 175, 80, 0.15)' :
                              aiStatus === 'analyzing' ? 'rgba(255, 193, 7, 0.15)' :
                              aiStatus === 'error' ? 'rgba(244, 67, 54, 0.15)' : 'rgba(150,150,150,0.1)',
                   color: aiStatus === 'connected' ? '#81c784' :
                          aiStatus === 'analyzing' ? '#ffd54f' :
                          aiStatus === 'error' ? '#ef5350' : 'var(--auth-text-muted)',
                   border: aiStatus === 'connected' ? '1px solid rgba(76,175,80,0.4)' :
                           aiStatus === 'error' ? '1px solid rgba(244,67,54,0.4)' : '1px solid transparent',
                   padding: '8px 16px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap'
                 }}>
              🤖 {aiStatus === 'connected' ? 'AI Model Connected' :
                  aiStatus === 'analyzing' ? 'AI Analyzing...' :
                  aiStatus === 'error' ? 'AI Connection Error' : 'AI Idle'}
            </div>
          </div>
        </div>

        <div className="network-stats-row">
          <div className="net-stat-card">
            <div className="net-stat-icon blue">📦</div>
            <div className="net-stat-info">
              <h3>Requests (10m)</h3>
              <p className="stat-val">{packetsTotal.toLocaleString()}</p>
            </div>
          </div>
          <div className="net-stat-card">
            <div className="net-stat-icon green">⬇️</div>
            <div className="net-stat-info">
              <h3>GET Requests (20s)</h3>
              <p className="stat-val">{Number(bandwidthOut || 0).toLocaleString()}</p>
            </div>
          </div>
          <div className="net-stat-card">
            <div className="net-stat-icon orange">🔗</div>
            <div className="net-stat-info">
              <h3>Active Connections</h3>
              <p className="stat-val">{activeConnections}</p>
            </div>
          </div>
          <div className="net-stat-card">
            <div className="net-stat-icon red">🛑</div>
            <div className="net-stat-info">
              <h3>AI Threats (Current)</h3>
              <p className="stat-val">{anomalyCount}</p>
            </div>
          </div>
        </div>

        <div className="net-main-grid">
          <div className="net-panel-card">
            <div className="net-panel-header">
              <h2>📈 Domain Traffic Flow (Real-time)</h2>
              <div className="net-controls">
                {isSimulating ? (
                  <button className="net-btn stop" onClick={() => setIsSimulating(false)}>
                    ⏸ Pause
                  </button>
                ) : (
                  <button className="net-btn start" onClick={() => setIsSimulating(true)}>
                    ▶️ Start
                  </button>
                )}
              </div>
            </div>
            <div className="net-chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trafficData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#81c784" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#81c784" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#64b5f6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#64b5f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="time" stroke="var(--auth-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--auth-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--auth-form-bg)', borderColor: 'var(--auth-glass-border)', color: '#fff', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Area type="monotone" dataKey="inbound" name="Requests (20s)" stroke="#81c784" strokeWidth={3} fillOpacity={1} fill="url(#colorIn)" isAnimationActive={false} />
                  <Area type="monotone" dataKey="outbound" name="GET Requests (20s)" stroke="#64b5f6" strokeWidth={3} fillOpacity={1} fill="url(#colorOut)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="net-panel-card">
            <div className="net-panel-header">
              <h2>🚨 AI Anomaly Logs</h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--auth-text-muted)' }}>Domain-conditioned IDS alerts</span>
            </div>
            <div className="anomaly-list">
              {anomalies.map(anom => (
                <div key={anom.id} className={`anomaly-item ${anom.type}`}>
                  <div className="anom-header">
                    <span className={`anom-type ${anom.type}`}>{anom.type === 'critical' ? 'Critical Risk' : 'Warning'}</span>
                    <span className="anom-time">{anom.time}</span>
                  </div>
                  <p className="anom-desc">{anom.desc}</p>
                  <div className="anom-ip">Source IP: {anom.ip}</div>
                </div>
              ))}
              {anomalies.length === 0 && (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--auth-text-muted)' }}>
                  {isSimulating ? '🤖 AI model is monitoring domain traffic... Waiting for anomalies.' : 'No anomalies detected yet. Start monitoring to begin analysis.'}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="net-panel-card" style={{ marginBottom: '50px' }}>
          <div className="net-panel-header">
            <h2>🌐 Active IP Connection Matrix</h2>
            <span style={{ fontSize: '0.9rem', color: 'var(--auth-text-muted)' }}>{monitoredDomain}</span>
          </div>
          <div className="net-table-container">
            <table className="net-table">
              <thead>
                <tr>
                  <th>IP Address</th>
                  <th>Method Mix</th>
                  <th>Request Count</th>
                  <th>Last Seen</th>
                  <th>Risk Level</th>
                </tr>
              </thead>
              <tbody>
                {activeIPs.map((ipObj, idx) => (
                  <tr key={idx}>
                    <td style={{ fontFamily: 'monospace', color: '#64b5f6' }}>{ipObj.ip}</td>
                    <td>{ipObj.protocol}</td>
                    <td>{Number(ipObj.request_count ?? ipObj.packets ?? 0).toLocaleString()}</td>
                    <td>{ipObj.last_seen ? new Date(ipObj.last_seen).toLocaleString('tr-TR') : '-'}</td>
                    <td>
                      <span className={`risk-badge ${ipObj.risk}`}>
                        {ipObj.risk === 'low' ? 'Low' : ipObj.risk === 'high' ? 'High' : 'Critical'}
                      </span>
                    </td>
                  </tr>
                ))}
                {activeIPs.length === 0 && (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', color: 'var(--auth-text-muted)', padding: '20px' }}>
                      No active IP telemetry yet. Monitoring will populate this table.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
