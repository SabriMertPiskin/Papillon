import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/Encryption.css';

// SVG Icons
const IconCopy = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
  </svg>
);

const IconAlert = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="12" y1="8" x2="12" y2="12"></line>
    <line x1="12" y1="16" x2="12.01" y2="16"></line>
  </svg>
);

const IconCheck = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
    <polyline points="22 4 12 14.01 9 11.01"></polyline>
  </svg>
);

export default function Encryption() {
  // Theme sync
  useEffect(() => {
    const theme = localStorage.getItem('papillon-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  }, []);

  const [plaintext, setPlaintext] = useState('');
  const [algorithm, setAlgorithm] = useState('AES-256-GCM');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copySuccess, setCopySuccess] = useState('');

  // Decryption states
  const [decryptAlgorithm, setDecryptAlgorithm] = useState('AES-256-GCM');
  const [ciphertext, setCiphertext] = useState('');
  const [decryptKey, setDecryptKey] = useState('');
  const [decryptNonce, setDecryptNonce] = useState('');
  const [decryptPrivateKey, setDecryptPrivateKey] = useState('');
  const [decryptResult, setDecryptResult] = useState(null);
  const [decryptLoading, setDecryptLoading] = useState(false);
  const [decryptError, setDecryptError] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [navigate]);

  const algorithmDescriptions = {
    'AES-256-GCM': 'Simetrik şifreleme. Aynı anahtarla şifrelenir ve çözülür. Hızlı ve güvenli.',
    'RSA-2048': 'Asimetrik şifreleme. Public key ile şifreleme, Private key ile şifre çözme.',
    'MD5': 'Hash fonksiyonu. DEPRECATED! Sadece referans için.',
    'SHA-1': 'Hash fonksiyonu. DEPRECATED! Sadece referans için.',
    'SHA-256': 'Gelişmiş Hash fonksiyonu. Bütünlük doğrulaması için güvenli.',
    'SHA-512': 'En güvenli Hash algoritması. Uzun veri blogları için ideal.',
    'Base64': 'Sadece kodlama (Encoding). Gizlilik sağlamaz, veri transferi içindir.'
  };

  const handleEncrypt = async (e) => {
    e.preventDefault();
    if (!plaintext.trim()) {
      setError('Lütfen işlenecek metni girin.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await axios.post('http://localhost:8000/crypto/encrypt/', {
        text: plaintext,
        algorithm: algorithm
      }, { withCredentials: true });

      if (response.data.success) {
        setResult(response.data);
      } else {
        setError(response.data.detail);
      }
    } catch (err) {
      setError('İşlem sırasında sunucu hatası oluştu.');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDecrypt = async (e) => {
    e.preventDefault();
    if (!ciphertext.trim()) {
      setDecryptError('Lütfen çözülecek şifreli metni girin.');
      return;
    }

    if (decryptAlgorithm === 'AES-256-GCM' && (!decryptKey.trim() || !decryptNonce.trim())) {
      setDecryptError('AES-256-GCM çözümü için Key ve Nonce gereklidir.');
      return;
    }

    if (decryptAlgorithm === 'RSA-2048' && !decryptPrivateKey.trim()) {
      setDecryptError('RSA-2048 çözümü için Private Key gereklidir.');
      return;
    }

    setDecryptLoading(true);
    setDecryptError(null);
    setDecryptResult(null);

    try {
      const payload = {
        ciphertext: ciphertext,
        algorithm: decryptAlgorithm
      };

      if (decryptAlgorithm === 'AES-256-GCM') {
        payload.key = decryptKey;
        payload.nonce = decryptNonce;
      } else if (decryptAlgorithm === 'RSA-2048') {
        payload.private_key = decryptPrivateKey;
      }

      const response = await axios.post('http://localhost:8000/crypto/decrypt/', payload, {
        withCredentials: true
      });

      if (response.data.success) {
        setDecryptResult(response.data);
      } else {
        setDecryptError(response.data.detail);
      }
    } catch (err) {
      setDecryptError('Şifre çözme başarısız oldu. Girdiğiniz verileri kontrol edin.');
      console.error('Error:', err);
    } finally {
      setDecryptLoading(false);
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopySuccess(id);
    setTimeout(() => setCopySuccess(''), 2000);
  };

  return (
    <div className="encryption-layout">
      {/* Header */}
      <div className="encryption-header">
        <div className="header-title-group">
          <div className="header-icon">🔐</div>
          <div className="header-title">
            <h1>Metin Şifreleme</h1>
            <p>AES, RSA ve Hash algoritmaları ile güvenli veri manipülasyonu</p>
          </div>
        </div>
        <button onClick={() => navigate('/dashboard')} className="back-btn">
          <span>←</span> Dashboard'a Dön
        </button>
      </div>

      <div className="encryption-grid">
        {/* ================= ENCRYPT CARD ================= */}
        <div className="crypto-card encrypt-card">
          <h2 className="card-title encrypt-title">
            <span style={{fontSize: '1.5rem'}}>🔒</span> Şifrele & Hash
          </h2>
          
          {error && (
            <div className="error-message">
              <IconAlert /> {error}
            </div>
          )}

          <form onSubmit={handleEncrypt} className="crypto-form">
            <div className="form-group">
              <label>İşlenecek Metin</label>
              <textarea
                className="crypto-input"
                value={plaintext}
                onChange={(e) => setPlaintext(e.target.value)}
                placeholder="Örn: Gizli askeri kordinatlar veya şifreler..."
                rows={4}
              />
            </div>

            <div className="form-group">
              <label>Güvenlik Algoritması</label>
              <select 
                className="crypto-input"
                value={algorithm} 
                onChange={(e) => setAlgorithm(e.target.value)}
              >
                <optgroup label="Şifreleme (Encryption)">
                  <option value="AES-256-GCM">AES-256-GCM (Simetrik - Önerilen)</option>
                  <option value="RSA-2048">RSA-2048 (Asimetrik)</option>
                </optgroup>
                <optgroup label="Özet Alma (Hashing)">
                  <option value="SHA-256">SHA-256 (Güvenli Hash)</option>
                  <option value="SHA-512">SHA-512 (Ultra Güvenli Hash)</option>
                  <option value="SHA-1">SHA-1 (Zayıf Hash)</option>
                  <option value="MD5">MD5 (Kırılmış Hash)</option>
                </optgroup>
                <optgroup label="Kodlama (Encoding)">
                  <option value="Base64">Base64 (Şifreleme Değildir)</option>
                </optgroup>
              </select>
            </div>

            <div className="algorithm-info">
              {algorithmDescriptions[algorithm]}
            </div>

            <button type="submit" disabled={loading} className="action-btn encrypt">
              {loading ? 'İşleniyor...' : 'Kriptola'}
            </button>
          </form>

          {/* Encrypt Result Area */}
          {result && (
            <div className="result-container">
              <h4>İşlem Sonucu <span style={{fontSize: '0.8rem', opacity: 0.6}}>({result.algorithm})</span></h4>
              
              {result.note && (
                <div className="result-note">
                  <IconCheck /> {result.note}
                </div>
              )}

              {result.algorithm === 'AES-256-GCM' && (
                <>
                  <div className="result-item">
                    <label>Şifreli Metin (Ciphertext)</label>
                    <div className="result-box">
                      <code>{result.encrypted.ciphertext}</code>
                      <button className="copy-btn" onClick={() => copyToClipboard(result.encrypted.ciphertext, 'aes-cipher')} title="Kopyala">
                        {copySuccess === 'aes-cipher' ? <IconCheck /> : <IconCopy />}
                      </button>
                    </div>
                  </div>
                  <div className="result-item">
                    <label>Key (Gizli Anahtar - 256 bit)</label>
                    <div className="result-box">
                      <code>{result.encrypted.key}</code>
                      <button className="copy-btn" onClick={() => copyToClipboard(result.encrypted.key, 'aes-key')} title="Kopyala">
                        {copySuccess === 'aes-key' ? <IconCheck /> : <IconCopy />}
                      </button>
                    </div>
                  </div>
                  <div className="result-item">
                    <label>Nonce (Initialization Vector - 96 bit)</label>
                    <div className="result-box">
                      <code>{result.encrypted.nonce}</code>
                      <button className="copy-btn" onClick={() => copyToClipboard(result.encrypted.nonce, 'aes-nonce')} title="Kopyala">
                        {copySuccess === 'aes-nonce' ? <IconCheck /> : <IconCopy />}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {result.algorithm === 'RSA-2048' && (
                <>
                  <div className="result-item">
                    <label>Şifreli Metin (Ciphertext)</label>
                    <div className="result-box">
                      <code>{result.encrypted.ciphertext}</code>
                      <button className="copy-btn" onClick={() => copyToClipboard(result.encrypted.ciphertext, 'rsa-cipher')} title="Kopyala">
                        {copySuccess === 'rsa-cipher' ? <IconCheck /> : <IconCopy />}
                      </button>
                    </div>
                  </div>
                  <div className="result-item">
                    <label>Public Key (Açık Anahtar)</label>
                    <div className="result-box">
                      <pre>{result.encrypted.public_key}</pre>
                      <button className="copy-btn" onClick={() => copyToClipboard(result.encrypted.public_key, 'rsa-pub')} title="Kopyala">
                        {copySuccess === 'rsa-pub' ? <IconCheck /> : <IconCopy />}
                      </button>
                    </div>
                  </div>
                  <div className="result-item">
                    <label style={{color: '#ff5252'}}>Private Key (Gizli Anahtar - KİMSE İLE PAYLAŞMAYIN)</label>
                    <div className="result-box">
                      <pre className="private-key">{result.encrypted.private_key}</pre>
                      <button className="copy-btn" onClick={() => copyToClipboard(result.encrypted.private_key, 'rsa-priv')} title="Kopyala">
                        {copySuccess === 'rsa-priv' ? <IconCheck /> : <IconCopy />}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {['MD5', 'SHA-1', 'SHA-256', 'SHA-512', 'Base64'].includes(result.algorithm) && (
                <div className="result-item">
                  <label>{result.algorithm === 'Base64' ? 'Base64 Çıktısı' : 'Hash Çıktısı (Digest)'}</label>
                  <div className="result-box">
                    <code>{result.encrypted.hash || result.encrypted.encoded}</code>
                    <button className="copy-btn" onClick={() => copyToClipboard(result.encrypted.hash || result.encrypted.encoded, 'hash-out')} title="Kopyala">
                      {copySuccess === 'hash-out' ? <IconCheck /> : <IconCopy />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ================= DECRYPT CARD ================= */}
        <div className="crypto-card decrypt-card">
          <h2 className="card-title decrypt-title">
            <span style={{fontSize: '1.5rem'}}>🔓</span> Şifre Çöz & Decode
          </h2>
          
          {decryptError && (
            <div className="error-message">
              <IconAlert /> {decryptError}
            </div>
          )}

          <form onSubmit={handleDecrypt} className="crypto-form">
            <div className="form-group">
              <label>Algoritma Tipi</label>
              <select 
                className="crypto-input"
                value={decryptAlgorithm} 
                onChange={(e) => setDecryptAlgorithm(e.target.value)}
              >
                <option value="AES-256-GCM">AES-256-GCM (Simetrik Çözümleme)</option>
                <option value="RSA-2048">RSA-2048 (Asimetrik Çözümleme)</option>
                <option value="Base64">Base64 (Decode)</option>
              </select>
            </div>

            <div className="form-group">
              <label>Şifreli / Kodlu Metin</label>
              <textarea
                className="crypto-input"
                value={ciphertext}
                onChange={(e) => setCiphertext(e.target.value)}
                placeholder="Örn: U2FsdGVkX1+... veya Base64 formatında metin"
                rows={3}
              />
            </div>

            {decryptAlgorithm === 'AES-256-GCM' && (
              <>
                <div className="form-group">
                  <label>Gizli Anahtar (Key) - Base64 Formatında</label>
                  <textarea
                    className="crypto-input"
                    value={decryptKey}
                    onChange={(e) => setDecryptKey(e.target.value)}
                    placeholder="Şifreleme sırasında oluşturulan Key değerini girin"
                    rows={2}
                  />
                </div>
                <div className="form-group">
                  <label>Nonce (IV) - Base64 Formatında</label>
                  <textarea
                    className="crypto-input"
                    value={decryptNonce}
                    onChange={(e) => setDecryptNonce(e.target.value)}
                    placeholder="Şifreleme sırasında oluşturulan Nonce değerini girin"
                    rows={2}
                  />
                </div>
              </>
            )}

            {decryptAlgorithm === 'RSA-2048' && (
              <div className="form-group">
                <label>Gizli Anahtar (Private Key) - PEM Formatında</label>
                <textarea
                  className="crypto-input"
                  style={{fontFamily: 'monospace', fontSize: '0.8rem'}}
                  value={decryptPrivateKey}
                  onChange={(e) => setDecryptPrivateKey(e.target.value)}
                  placeholder="-----BEGIN RSA PRIVATE KEY-----..."
                  rows={4}
                />
              </div>
            )}

            <div className="algorithm-info" style={{background: 'rgba(124, 77, 255, 0.1)', borderLeftColor: '#b388ff'}}>
              {decryptAlgorithm === 'AES-256-GCM' && 'Şifreyi çözebilmek için orijinal Key ve Nonce değerlerinin tam olarak uyuşması şarttır.'}
              {decryptAlgorithm === 'RSA-2048' && 'Metin Public Key ile şifrelendiyse, sadece ona ait olan Private Key kullanılarak çözülebilir.'}
              {decryptAlgorithm === 'Base64' && 'Düz metne çevirmek için geri dönüştürür. Ekstra bilgi gerekmez.'}
            </div>

            <button type="submit" disabled={decryptLoading} className="action-btn decrypt">
              {decryptLoading ? 'Çözülüyor...' : 'Şifreyi Çöz'}
            </button>
          </form>

          {/* Decrypt Result Area */}
          {decryptResult && (
            <div className="result-container">
              <h4>Çözümleme Sonucu <span style={{fontSize: '0.8rem', opacity: 0.6}}>({decryptResult.algorithm})</span></h4>
              
              {decryptResult.note && (
                <div className="result-note">
                  <IconCheck /> {decryptResult.note}
                </div>
              )}

              <div className="result-item">
                <label>Orijinal / Çözülen Metin</label>
                <div className="result-box" style={{borderColor: '#b388ff'}}>
                  <code>{decryptResult.decrypted}</code>
                  <button className="copy-btn" onClick={() => copyToClipboard(decryptResult.decrypted, 'decrypted-out')} title="Kopyala">
                    {copySuccess === 'decrypted-out' ? <IconCheck /> : <IconCopy />}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}