import React, { useState, useEffect, useRef } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import DashboardLayout from '../components/DashboardLayout';
import '../styles/NetworkTraffic.css';

// --- Helper Simulator Functions ---
const generateTimeStr = (date) => {
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
};

const SIMULATED_IPS = ['192.168.1.105', '10.0.0.42', '45.33.12.89', '185.20.10.2', '8.8.8.8', '114.114.114.114'];
const SIMULATED_PROTOCOLS = ['TCP', 'UDP', 'ICMP', 'HTTP', 'HTTPS'];

export default function NetworkTraffic() {
  const [isSimulating, setIsSimulating] = useState(false);
  
  // Chart Data State
  const [trafficData, setTrafficData] = useState([]);
  
  // Stats Data
  const [packetsTotal, setPacketsTotal] = useState(12435);
  const [bandwidthOut, setBandwidthOut] = useState(124.5);
  const [activeConnections, setActiveConnections] = useState(142);
  const [anomalyCount, setAnomalyCount] = useState(3);

  // Anomalies list
  const [anomalies, setAnomalies] = useState([
    { id: 1, time: generateTimeStr(new Date(Date.now() - 120000)), type: 'warning', ip: '45.33.12.89', desc: 'Unusual Port Scan Detected (Port 22)' },
    { id: 2, time: generateTimeStr(new Date(Date.now() - 300000)), type: 'critical', ip: '185.20.10.2', desc: 'DDoS (SYN Flood) Attack Attempt Detected' },
    { id: 3, time: generateTimeStr(new Date(Date.now() - 600000)), type: 'warning', ip: '114.114.114.114', desc: 'High DNS Query Frequency' }
  ]);

  // Table Data (Active IPs)
  const [activeIPs, setActiveIPs] = useState([
    { ip: '192.168.1.105', protocol: 'HTTPS', packets: 4320, risk: 'low' },
    { ip: '10.0.0.42', protocol: 'TCP', packets: 850, risk: 'low' },
    { ip: '45.33.12.89', protocol: 'ICMP', packets: 12550, risk: 'high' },
    { ip: '185.20.10.2', protocol: 'TCP', packets: 95400, risk: 'critical' },
  ]);

  const intervalRef = useRef(null);

  // Initial Fake Data Loading
  useEffect(() => {
    const initData = [];
    let now = new Date();
    for (let i = 20; i >= 0; i--) {
      const pastTime = new Date(now.getTime() - i * 2000);
      initData.push({
        time: generateTimeStr(pastTime),
        inbound: Math.floor(Math.random() * 500) + 100,
        outbound: Math.floor(Math.random() * 400) + 50,
      });
    }
    setTrafficData(initData);
    
    // Auto-start simulation to make it lively
    setIsSimulating(true);

    return () => clearInterval(intervalRef.current);
  }, []);

  useEffect(() => {
    if (isSimulating) {
      intervalRef.current = setInterval(() => {
        // --- Generate Chart Data ---
        const now = new Date();
        const newInbound = Math.floor(Math.random() * 600) + 150;
        const newOutbound = Math.floor(Math.random() * 450) + 80;
        
        // Randomly simulate traffic spike (Anomaly Attack)
        let isSpike = Math.random() > 0.92;
        let spikeIn = isSpike ? newInbound * 4 : newInbound;
        
        setTrafficData(prev => {
          const newData = [...prev, { time: generateTimeStr(now), inbound: spikeIn, outbound: newOutbound }];
          if (newData.length > 20) newData.shift(); // Keep last 20 points
          return newData;
        });

        // --- Update Stats ---
        setPacketsTotal(prev => prev + Math.floor(spikeIn / 10));
        setBandwidthOut(prev => +(prev + (newOutbound / 500)).toFixed(1));
        
        // --- Trigger Anomaly Detection (AI Simulation) ---
        if (isSpike) {
          const badIP = SIMULATED_IPS[Math.floor(Math.random() * SIMULATED_IPS.length)];
          const newAnomaly = {
            id: Date.now(),
            time: generateTimeStr(now),
            type: 'critical',
            ip: badIP,
            desc: `Abnormal Traffic Spike (AI Model: XGBoost IDS Triggered)`
          };
          setAnomalies(prev => [newAnomaly, ...prev].slice(0, 50)); // Keep max 50
          setAnomalyCount(prev => prev + 1);
          
          setActiveIPs(prev => {
            const exists = prev.find(p => p.ip === badIP);
            if (exists) {
              return prev.map(p => p.ip === badIP ? { ...p, packets: p.packets + 5000, risk: 'high'} : p);
            }
            return [{ ip: badIP, protocol: 'HTTPS', packets: 5000, risk: 'high' }, ...prev].slice(0, 10);
          });
        }

      }, 2000); // Trigger every 2s to match Dash/WebSocket feeling
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isSimulating]);


  return (
    <DashboardLayout>
      <div className="network-page-container">
        <div className="network-header">
          <h1>🌐 Network Traffic & IDS Analysis</h1>
          <p>Real-time attack detection and packet analysis powered by AI (XGBoost).</p>
          <div className={`live-badge ${!isSimulating ? 'stopped' : ''}`}>
            <div className={`live-indicator ${!isSimulating ? 'stopped' : ''}`}></div>
            {isSimulating ? 'SYSTEM ACTIVE (SIMULATION)' : 'SYSTEM STOPPED'}
          </div>
        </div>

        <div className="network-stats-row">
          <div className="net-stat-card">
            <div className="net-stat-icon blue">📦</div>
            <div className="net-stat-info">
              <h3>Packets Processed</h3>
              <p className="stat-val">{packetsTotal.toLocaleString()}</p>
            </div>
          </div>
          <div className="net-stat-card">
            <div className="net-stat-icon green">⬇️</div>
            <div className="net-stat-info">
              <h3>Bandwidth</h3>
              <p className="stat-val">{bandwidthOut} <span style={{fontSize: '1rem'}}>MB/s</span></p>
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
              <h3>Blocked Threats</h3>
              <p className="stat-val">{anomalyCount}</p>
            </div>
          </div>
        </div>

        <div className="net-main-grid">
          {/* Main Chart Panel */}
          <div className="net-panel-card">
            <div className="net-panel-header">
              <h2>📈 Network Traffic Flow (Real-time)</h2>
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
                      <stop offset="5%" stopColor="#81c784" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#81c784" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#64b5f6" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#64b5f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="time" stroke="var(--auth-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--auth-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--auth-form-bg)', borderColor: 'var(--auth-glass-border)', color: '#fff', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Area type="monotone" dataKey="inbound" name="Inbound Traffic (Kbps)" stroke="#81c784" strokeWidth={3} fillOpacity={1} fill="url(#colorIn)" isAnimationActive={false} />
                  <Area type="monotone" dataKey="outbound" name="Outbound Traffic (Kbps)" stroke="#64b5f6" strokeWidth={3} fillOpacity={1} fill="url(#colorOut)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* AI Anomaly Panel */}
          <div className="net-panel-card">
            <div className="net-panel-header">
              <h2>🚨 AI Anomaly Logs</h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--auth-text-muted)' }}>Last 50 entries</span>
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
                  No anomalies detected yet.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Active IP Matrix */}
        <div className="net-panel-card" style={{ marginBottom: '50px' }}>
          <div className="net-panel-header">
            <h2>🌐 Active IP Connection Matrix</h2>
            <span style={{ fontSize: '0.9rem', color: 'var(--auth-text-muted)' }}>Top 10 IPs</span>
          </div>
          <div className="net-table-container">
            <table className="net-table">
              <thead>
                <tr>
                  <th>IP Address</th>
                  <th>Protocol</th>
                  <th>Total Packets</th>
                  <th>Risk Level</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {activeIPs.map((ipObj, idx) => (
                  <tr key={idx}>
                    <td style={{ fontFamily: 'monospace', color: '#64b5f6' }}>{ipObj.ip}</td>
                    <td>{ipObj.protocol}</td>
                    <td>{ipObj.packets.toLocaleString()}</td>
                    <td>
                      <span className={`risk-badge ${ipObj.risk}`}>
                        {ipObj.risk === 'low' ? 'Low' : ipObj.risk === 'medium' ? 'Medium' : 'High'}
                      </span>
                    </td>
                    <td>
                      <button 
                        style={{ background: 'transparent', border: '1px solid #ef5350', color: '#ef5350', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                        onClick={() => alert(`IP block request: ${ipObj.ip}\n\n(Backend connection pending)`)}
                      >
                        Block
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
