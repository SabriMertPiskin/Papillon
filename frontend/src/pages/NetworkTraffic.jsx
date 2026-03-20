import React, { useState, useEffect, useRef } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import DashboardLayout from '../components/DashboardLayout';
import { analyzeNetworkBatch } from '../services/api';
import '../styles/NetworkTraffic.css';

// --- Helper Functions ---
const generateTimeStr = (date) => {
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
};

const SIMULATED_IPS = ['192.168.1.105', '10.0.0.42', '45.33.12.89', '185.20.10.2', '8.8.8.8', '114.114.114.114'];
const SIMULATED_PROTOCOLS = ['TCP', 'UDP', 'ICMP', 'HTTP', 'HTTPS'];

/**
 * Simüle edilmiş network traffic feature vektörü üretir.
 * Model'in scaler'ı tam olarak 48 feature bekliyor.
 * Normal trafik vs saldırı trafiği farklı dağılımlarla üretilir.
 */
const generateNetworkFeatures = (isSpike = false) => {
  const features = [];
  
  if (isSpike) {
    // Saldırı benzeri trafik: yüksek paket/byte, anormal oranlar
    for (let i = 0; i < 48; i++) {
      if (i < 5) features.push(Math.random() * 100000 + 10000);       // flow bytes/packets - yüksek
      else if (i < 10) features.push(Math.random() * 50000 + 5000);   // bwd/fwd bytes
      else if (i < 20) features.push(Math.random() * 1000 + 100);     // packet length stats
      else if (i < 30) features.push(Math.random() * 500 + 50);       // flow duration, IAT
      else if (i < 40) features.push(Math.random() * 100);            // flag counts
      else features.push(Math.random() * 10);                          // ratios
    }
  } else {
    // Normal trafik: düşük değerler, düzenli oranlar
    for (let i = 0; i < 48; i++) {
      if (i < 5) features.push(Math.random() * 5000);                 // flow bytes/packets - normal
      else if (i < 10) features.push(Math.random() * 2000);           // bwd/fwd bytes
      else if (i < 20) features.push(Math.random() * 200);            // packet length stats
      else if (i < 30) features.push(Math.random() * 100);            // flow duration, IAT
      else if (i < 40) features.push(Math.random() * 10);             // flag counts
      else features.push(Math.random() * 2);                           // ratios
    }
  }
  
  return features;
};

export default function NetworkTraffic() {
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
  const cycleRef = useRef(0);

  // Initial chart data
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
    setIsSimulating(true);
    return () => clearInterval(intervalRef.current);
  }, []);

  useEffect(() => {
    if (isSimulating) {
      intervalRef.current = setInterval(async () => {
        const now = new Date();
        const newInbound = Math.floor(Math.random() * 600) + 150;
        const newOutbound = Math.floor(Math.random() * 450) + 80;
        
        // Periyodik trafik spike simülasyonu
        let isSpike = Math.random() > 0.92;
        let spikeIn = isSpike ? newInbound * 4 : newInbound;
        
        setTrafficData(prev => {
          const newData = [...prev, { time: generateTimeStr(now), inbound: spikeIn, outbound: newOutbound }];
          if (newData.length > 20) newData.shift();
          return newData;
        });

        setPacketsTotal(prev => prev + Math.floor(spikeIn / 10));
        setBandwidthOut(prev => +(prev + (newOutbound / 500)).toFixed(1));
        setActiveConnections(Math.floor(Math.random() * 80) + 100);

        cycleRef.current += 1;

        // Her 3 cycle'da bir AI batch analiz yap (6 saniyede bir)
        if (cycleRef.current % 3 === 0) {
          setAiStatus('analyzing');
          
          // 5 adet sample üret (mix: normal + potansiyel saldırı)
          const samples = [];
          for (let i = 0; i < 5; i++) {
            const sampleSpike = i === 0 && isSpike; // İlk sample spike ise
            samples.push(generateNetworkFeatures(sampleSpike || Math.random() > 0.85));
          }

          try {
            const response = await analyzeNetworkBatch(samples);
            
            if (response.data.success) {
              setAiStatus('connected');
              const results = response.data.results;
              const stats = response.data.stats;

              // Tehdit algılandıysa anomaly log ekle
              results.forEach((r) => {
                if (r.risk_level !== 'low') {
                  const srcIP = SIMULATED_IPS[Math.floor(Math.random() * SIMULATED_IPS.length)];
                  setAnomalies(prev => [{
                    id: Date.now() + r.index,
                    time: generateTimeStr(new Date()),
                    type: r.risk_level === 'critical' ? 'critical' : 'warning',
                    ip: srcIP,
                    desc: `AI IDS: ${r.prediction} detected (${r.label})`,
                  }, ...prev].slice(0, 50));

                  setAnomalyCount(prev => prev + 1);

                  // IP tablosunu güncelle
                  setActiveIPs(prev => {
                    const exists = prev.find(p => p.ip === srcIP);
                    if (exists) {
                      return prev.map(p => p.ip === srcIP ? { ...p, packets: p.packets + 5000, risk: r.risk_level } : p);
                    }
                    return [{ ip: srcIP, protocol: SIMULATED_PROTOCOLS[Math.floor(Math.random() * SIMULATED_PROTOCOLS.length)], packets: 5000, risk: r.risk_level }, ...prev].slice(0, 10);
                  });
                }
              });

              // İstatistik güncelle
              if (stats.threats > 0) {
                setAnomalyCount(prev => prev + stats.threats);
              }
            } else {
              setAiStatus('error');
            }
          } catch (err) {
            console.error('AI IDS batch analysis failed:', err);
            setAiStatus('error');
            // Hata olsa da UI çalışmaya devam etsin
          }

          // 2 saniye sonra status'u idle'a döndür
          setTimeout(() => setAiStatus(prev => prev === 'analyzing' ? 'idle' : prev), 2000);
        }

      }, 2000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isSimulating]);


  return (
    <DashboardLayout>
      <div className="network-page-container">
        <div className="network-header">
          <div>
            <h1>🌐 Network Traffic & IDS Analysis</h1>
            <p>Real-time attack detection and packet analysis powered by AI (XGBoost IDS Model).</p>
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
              <h3>AI Detected Threats</h3>
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
              <span style={{ fontSize: '0.8rem', color: 'var(--auth-text-muted)' }}>Powered by XGBoost IDS</span>
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
                  {isSimulating ? '🤖 AI model is monitoring traffic... Waiting for anomalies.' : 'No anomalies detected yet. Start the system to begin monitoring.'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Active IP Matrix */}
        <div className="net-panel-card" style={{ marginBottom: '50px' }}>
          <div className="net-panel-header">
            <h2>🌐 Active IP Connection Matrix</h2>
            <span style={{ fontSize: '0.9rem', color: 'var(--auth-text-muted)' }}>AI-flagged IPs</span>
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
                        {ipObj.risk === 'low' ? 'Low' : ipObj.risk === 'high' ? 'High' : 'Critical'}
                      </span>
                    </td>
                    <td>
                      <button 
                        style={{ background: 'transparent', border: '1px solid #ef5350', color: '#ef5350', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                        onClick={() => alert(`IP blocked: ${ipObj.ip}`)}
                      >
                        Block
                      </button>
                    </td>
                  </tr>
                ))}
                {activeIPs.length === 0 && (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', color: 'var(--auth-text-muted)', padding: '20px' }}>
                      No flagged IPs yet. AI is monitoring...
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
