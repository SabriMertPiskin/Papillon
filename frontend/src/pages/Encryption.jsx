import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/Encryption.css';

export default function Encryption() {
  const [plaintext, setPlaintext] = useState('');
  const [algorithm, setAlgorithm] = useState('AES-256-GCM');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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
    'AES-256-GCM': 'Simetrik şifreleme. Aynı key ile şifreleme ve şifre çözme yapılır. Hızlı ve güvenli.',
    'RSA-2048': 'Asimetrik şifreleme. Public key ile şifreleme, private key ile şifre çözme yapılır.',
    'MD5': 'Hash fonksiyonu. DEPRECATED! Sadece referans için.',
    'SHA-1': 'Hash fonksiyonu. DEPRECATED! Sadece referans için.',
    'SHA-256': 'Hash fonksiyonu. Güvenli. Passwordlar için bcrypt kullanın.',
    'SHA-512': 'Hash fonksiyonu. Güvenli. Passwordlar için bcrypt kullanın.',
    'Base64': 'Encoding (şifreleme değil). Gizlilik için kullanmayın!'
  };

  const handleEncrypt = async (e) => {
    e.preventDefault();
    
    if (!plaintext.trim()) {
      setError('Lütfen metni girin');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await axios.post('http://localhost:8000/crypto/encrypt/', {
        text: plaintext,
        algorithm: algorithm
      }, {
        withCredentials: true
      });

      if (response.data.success) {
        setResult(response.data);
      } else {
        setError(response.data.detail);
      }
    } catch (err) {
      setError('İşlem sırasında hata oluştu');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDecrypt = async (e) => {
    e.preventDefault();

    if (!ciphertext.trim()) {
      setDecryptError('Lütfen şifreli metni girin');
      return;
    }

    if (decryptAlgorithm === 'AES-256-GCM' && (!decryptKey.trim() || !decryptNonce.trim())) {
      setDecryptError('AES-256-GCM için key ve nonce gereklidir');
      return;
    }

    if (decryptAlgorithm === 'RSA-2048' && !decryptPrivateKey.trim()) {
      setDecryptError('RSA-2048 için private key gereklidir');
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
      setDecryptError('Şifre çözme sırasında hata oluştu');
      console.error('Error:', err);
    } finally {
      setDecryptLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Panoya kopyalandı!');
  };

  return (
    <div className="encryption-container">
      <div className="encryption-header">
        <h1>Metin Şifreleme Modülü</h1>
        <button onClick={() => navigate('/dashboard')} className="back-btn">
          Dashboard'a Dön
        </button>
      </div>

      <div className="encryption-content">
        {/* ENCRYPTION SECTION */}
        <div className="encryption-form">
          <h3>Metin Şifrele</h3>
          
          {error && <div className="error-message">{error}</div>}

          <form onSubmit={handleEncrypt}>
            <div className="form-group">
              <label>Metin:</label>
              <textarea
                value={plaintext}
                onChange={(e) => setPlaintext(e.target.value)}
                placeholder="İşlenecek metni buraya girin..."
                rows={5}
              />
            </div>

            <div className="form-group">
              <label>Algoritma:</label>
              <select value={algorithm} onChange={(e) => setAlgorithm(e.target.value)}>
                <optgroup label="Şifreleme">
                  <option value="AES-256-GCM">AES-256-GCM (Symmetric)</option>
                  <option value="RSA-2048">RSA-2048 (Asymmetric)</option>
                </optgroup>
                <optgroup label="Hash Fonksiyonları">
                  <option value="SHA-256">SHA-256 (Güvenli)</option>
                  <option value="SHA-512">SHA-512 (Güvenli)</option>
                  <option value="SHA-1">SHA-1 (Deprecated)</option>
                  <option value="MD5">MD5 (Deprecated)</option>
                </optgroup>
                <optgroup label="Encoding">
                  <option value="Base64">Base64 (Şifreleme Değil)</option>
                </optgroup>
              </select>
            </div>

            <div className="algorithm-info">
              <p>{algorithmDescriptions[algorithm]}</p>
            </div>

            <button type="submit" disabled={loading} className="encrypt-btn">
              {loading ? 'İşleniyor...' : 'Şifrele'}
            </button>
          </form>
        </div>

        {result && (
          <div className="encryption-result">
            <h3>Şifreleme Sonucu ({result.algorithm})</h3>
            
            <div className="result-note">
              {result.note}
            </div>

            {result.algorithm === 'AES-256-GCM' && (
              <>
                <div className="result-item">
                  <label>Şifreli Metin:</label>
                  <div className="result-value">
                    <code>{result.encrypted.ciphertext}</code>
                    <button onClick={() => copyToClipboard(result.encrypted.ciphertext)}>
                      Kopyala
                    </button>
                  </div>
                </div>

                <div className="result-item">
                  <label>Key (256-bit):</label>
                  <div className="result-value">
                    <code>{result.encrypted.key}</code>
                    <button onClick={() => copyToClipboard(result.encrypted.key)}>
                      Kopyala
                    </button>
                  </div>
                </div>

                <div className="result-item">
                  <label>Nonce (96-bit):</label>
                  <div className="result-value">
                    <code>{result.encrypted.nonce}</code>
                    <button onClick={() => copyToClipboard(result.encrypted.nonce)}>
                      Kopyala
                    </button>
                  </div>
                </div>
              </>
            )}

            {result.algorithm === 'RSA-2048' && (
              <>
                <div className="result-item">
                  <label>Şifreli Metin:</label>
                  <div className="result-value">
                    <code>{result.encrypted.ciphertext}</code>
                    <button onClick={() => copyToClipboard(result.encrypted.ciphertext)}>
                      Kopyala
                    </button>
                  </div>
                </div>

                <div className="result-item">
                  <label>Public Key:</label>
                  <div className="result-value">
                    <pre>{result.encrypted.public_key}</pre>
                    <button onClick={() => copyToClipboard(result.encrypted.public_key)}>
                      Kopyala
                    </button>
                  </div>
                </div>

                <div className="result-item">
                  <label>Private Key (SAKLAYIN!):</label>
                  <div className="result-value">
                    <pre className="private-key">{result.encrypted.private_key}</pre>
                    <button onClick={() => copyToClipboard(result.encrypted.private_key)}>
                      Kopyala
                    </button>
                  </div>
                </div>
              </>
            )}

            {['MD5', 'SHA-1', 'SHA-256', 'SHA-512', 'Base64'].includes(result.algorithm) && (
              <div className="result-item">
                <label>{result.algorithm === 'Base64' ? 'Encoded' : 'Hash'}:</label>
                <div className="result-value">
                  <code>{result.encrypted.hash || result.encrypted.encoded}</code>
                  <button onClick={() => copyToClipboard(result.encrypted.hash || result.encrypted.encoded)}>
                    Kopyala
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* DECRYPTION SECTION */}
        <div className="decryption-form">
          <h3>Şifreyi Çöz</h3>
          
          {decryptError && <div className="error-message">{decryptError}</div>}

          <form onSubmit={handleDecrypt}>
            <div className="form-group">
              <label>Algoritma:</label>
              <select value={decryptAlgorithm} onChange={(e) => setDecryptAlgorithm(e.target.value)}>
                <option value="AES-256-GCM">AES-256-GCM (Symmetric)</option>
                <option value="RSA-2048">RSA-2048 (Asymmetric)</option>
                <option value="Base64">Base64 (Decode)</option>
              </select>
            </div>

            <div className="form-group">
              <label>Şifreli Metin:</label>
              <textarea
                value={ciphertext}
                onChange={(e) => setCiphertext(e.target.value)}
                placeholder="Şifreli metni buraya yapıştırın..."
                rows={4}
              />
            </div>

            {decryptAlgorithm === 'AES-256-GCM' && (
              <>
                <div className="form-group">
                  <label>Key (Base64):</label>
                  <textarea
                    value={decryptKey}
                    onChange={(e) => setDecryptKey(e.target.value)}
                    placeholder="Key'i buraya yapıştırın..."
                    rows={2}
                  />
                </div>

                <div className="form-group">
                  <label>Nonce (Base64):</label>
                  <textarea
                    value={decryptNonce}
                    onChange={(e) => setDecryptNonce(e.target.value)}
                    placeholder="Nonce'u buraya yapıştırın..."
                    rows={2}
                  />
                </div>
              </>
            )}

            {decryptAlgorithm === 'RSA-2048' && (
              <div className="form-group">
                <label>Private Key (PEM):</label>
                <textarea
                  value={decryptPrivateKey}
                  onChange={(e) => setDecryptPrivateKey(e.target.value)}
                  placeholder="Private key'i buraya yapıştırın..."
                  rows={6}
                />
              </div>
            )}

            <button type="submit" disabled={decryptLoading} className="decrypt-btn">
              {decryptLoading ? 'Çözülüyor...' : 'Şifre Çöz'}
            </button>
          </form>
        </div>

        {decryptResult && (
          <div className="decryption-result">
            <h3>Şifre Çözme Sonucu ({decryptResult.algorithm})</h3>
            
            <div className="result-note">
              {decryptResult.note}
            </div>

            <div className="result-item">
              <label>Çözülen Metin:</label>
              <div className="result-value">
                <textarea
                  value={decryptResult.decrypted}
                  readOnly
                  rows={4}
                />
                <button onClick={() => copyToClipboard(decryptResult.decrypted)}>
                  Kopyala
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}