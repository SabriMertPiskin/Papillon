import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import DashboardLayout from '../components/DashboardLayout';
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
    'AES-256-GCM': 'Symmetric encryption. Encrypted and decrypted with the same key. Fast and secure.',
    'RSA-2048': 'Asymmetric encryption. Encrypt with public key, decrypt with private key.',
    'MD5': 'Hash function. DEPRECATED! For reference only.',
    'SHA-1': 'Hash function. DEPRECATED! For reference only.',
    'SHA-256': 'Advanced hash function. Secure for integrity verification.',
    'SHA-512': 'Most secure hash algorithm. Ideal for long data blocks.',
    'Base64': 'Encoding only. Does not provide confidentiality, used for data transfer.'
  };

  const handleEncrypt = async (e) => {
    e.preventDefault();
    if (!plaintext.trim()) {
      setError('Please enter the text to process.');
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
      setError('A server error occurred during the operation.');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDecrypt = async (e) => {
    e.preventDefault();
    if (!ciphertext.trim()) {
      setDecryptError('Please enter the encrypted text to decrypt.');
      return;
    }

    if (decryptAlgorithm === 'AES-256-GCM' && (!decryptKey.trim() || !decryptNonce.trim())) {
      setDecryptError('Key and Nonce are required for AES-256-GCM decryption.');
      return;
    }

    if (decryptAlgorithm === 'RSA-2048' && !decryptPrivateKey.trim()) {
      setDecryptError('Private Key is required for RSA-2048 decryption.');
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
      setDecryptError('Decryption failed. Please check your input data.');
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
    <DashboardLayout>
      <div className="encryption-layout">
        <div className="encryption-header">
          <div className="header-title-group">
            <div className="header-icon">🔐</div>
            <div className="header-title">
              <h1>Text Encryption</h1>
              <p>Secure data manipulation with AES, RSA and Hash algorithms</p>
            </div>
          </div>
        </div>

        <div className="encryption-grid">
          {/* ENCRYPT CARD */}
          <div className="crypto-card encrypt-card">
            <h2 className="card-title encrypt-title">
              <span style={{fontSize: '1.5rem'}}>🔒</span> Encrypt & Hash
            </h2>
            
            {error && (
              <div className="error-message">
                <IconAlert /> {error}
              </div>
            )}

            <form onSubmit={handleEncrypt} className="crypto-form">
              <div className="form-group">
                <label>Text to Process</label>
                <textarea
                  className="crypto-input"
                  value={plaintext}
                  onChange={(e) => setPlaintext(e.target.value)}
                  placeholder="e.g., Secret military coordinates or passwords..."
                  rows={4}
                />
              </div>

              <div className="form-group">
                <label>Security Algorithm</label>
                <select 
                  className="crypto-input"
                  value={algorithm} 
                  onChange={(e) => setAlgorithm(e.target.value)}
                >
                  <optgroup label="Encryption">
                    <option value="AES-256-GCM">AES-256-GCM (Symmetric - Recommended)</option>
                    <option value="RSA-2048">RSA-2048 (Asymmetric)</option>
                  </optgroup>
                  <optgroup label="Hashing">
                    <option value="SHA-256">SHA-256 (Secure Hash)</option>
                    <option value="SHA-512">SHA-512 (Ultra Secure Hash)</option>
                    <option value="SHA-1">SHA-1 (Weak Hash)</option>
                    <option value="MD5">MD5 (Broken Hash)</option>
                  </optgroup>
                  <optgroup label="Encoding">
                    <option value="Base64">Base64 (Not Encryption)</option>
                  </optgroup>
                </select>
              </div>

              <div className="algorithm-info">
                {algorithmDescriptions[algorithm]}
              </div>

              <button type="submit" disabled={loading} className="action-btn encrypt">
                {loading ? 'Processing...' : 'Encrypt'}
              </button>
            </form>

            {result && (
              <div className="result-container">
                <h4>Result <span style={{fontSize: '0.8rem', opacity: 0.6}}>({result.algorithm})</span></h4>
                
                {result.note && (
                  <div className="result-note">
                    <IconCheck /> {result.note}
                  </div>
                )}

                {result.algorithm === 'AES-256-GCM' && (
                  <>
                    <div className="result-item">
                      <label>Ciphertext</label>
                      <div className="result-box">
                        <code>{result.encrypted.ciphertext}</code>
                        <button className="copy-btn" onClick={() => copyToClipboard(result.encrypted.ciphertext, 'aes-cipher')} title="Copy">
                          {copySuccess === 'aes-cipher' ? <IconCheck /> : <IconCopy />}
                        </button>
                      </div>
                    </div>
                    <div className="result-item">
                      <label>Key (Secret Key - 256 bit)</label>
                      <div className="result-box">
                        <code>{result.encrypted.key}</code>
                        <button className="copy-btn" onClick={() => copyToClipboard(result.encrypted.key, 'aes-key')} title="Copy">
                          {copySuccess === 'aes-key' ? <IconCheck /> : <IconCopy />}
                        </button>
                      </div>
                    </div>
                    <div className="result-item">
                      <label>Nonce (Initialization Vector - 96 bit)</label>
                      <div className="result-box">
                        <code>{result.encrypted.nonce}</code>
                        <button className="copy-btn" onClick={() => copyToClipboard(result.encrypted.nonce, 'aes-nonce')} title="Copy">
                          {copySuccess === 'aes-nonce' ? <IconCheck /> : <IconCopy />}
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {result.algorithm === 'RSA-2048' && (
                  <>
                    <div className="result-item">
                      <label>Ciphertext</label>
                      <div className="result-box">
                        <code>{result.encrypted.ciphertext}</code>
                        <button className="copy-btn" onClick={() => copyToClipboard(result.encrypted.ciphertext, 'rsa-cipher')} title="Copy">
                          {copySuccess === 'rsa-cipher' ? <IconCheck /> : <IconCopy />}
                        </button>
                      </div>
                    </div>
                    <div className="result-item">
                      <label>Public Key</label>
                      <div className="result-box">
                        <pre>{result.encrypted.public_key}</pre>
                        <button className="copy-btn" onClick={() => copyToClipboard(result.encrypted.public_key, 'rsa-pub')} title="Copy">
                          {copySuccess === 'rsa-pub' ? <IconCheck /> : <IconCopy />}
                        </button>
                      </div>
                    </div>
                    <div className="result-item">
                      <label style={{color: '#ff5252'}}>Private Key (DO NOT SHARE WITH ANYONE)</label>
                      <div className="result-box">
                        <pre className="private-key">{result.encrypted.private_key}</pre>
                        <button className="copy-btn" onClick={() => copyToClipboard(result.encrypted.private_key, 'rsa-priv')} title="Copy">
                          {copySuccess === 'rsa-priv' ? <IconCheck /> : <IconCopy />}
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {['MD5', 'SHA-1', 'SHA-256', 'SHA-512', 'Base64'].includes(result.algorithm) && (
                  <div className="result-item">
                    <label>{result.algorithm === 'Base64' ? 'Base64 Output' : 'Hash Output (Digest)'}</label>
                    <div className="result-box">
                      <code>{result.encrypted.hash || result.encrypted.encoded}</code>
                      <button className="copy-btn" onClick={() => copyToClipboard(result.encrypted.hash || result.encrypted.encoded, 'hash-out')} title="Copy">
                        {copySuccess === 'hash-out' ? <IconCheck /> : <IconCopy />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* DECRYPT CARD */}
          <div className="crypto-card decrypt-card">
            <h2 className="card-title decrypt-title">
              <span style={{fontSize: '1.5rem'}}>🔓</span> Decrypt & Decode
            </h2>
            
            {decryptError && (
              <div className="error-message">
                <IconAlert /> {decryptError}
              </div>
            )}

            <form onSubmit={handleDecrypt} className="crypto-form">
              <div className="form-group">
                <label>Algorithm Type</label>
                <select 
                  className="crypto-input"
                  value={decryptAlgorithm} 
                  onChange={(e) => setDecryptAlgorithm(e.target.value)}
                >
                  <option value="AES-256-GCM">AES-256-GCM (Symmetric Decryption)</option>
                  <option value="RSA-2048">RSA-2048 (Asymmetric Decryption)</option>
                  <option value="Base64">Base64 (Decode)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Encrypted / Encoded Text</label>
                <textarea
                  className="crypto-input"
                  value={ciphertext}
                  onChange={(e) => setCiphertext(e.target.value)}
                  placeholder="e.g., U2FsdGVkX1+... or Base64 formatted text"
                  rows={3}
                />
              </div>

              {decryptAlgorithm === 'AES-256-GCM' && (
                <>
                  <div className="form-group">
                    <label>Secret Key - Base64 Format</label>
                    <textarea
                      className="crypto-input"
                      value={decryptKey}
                      onChange={(e) => setDecryptKey(e.target.value)}
                      placeholder="Enter the Key value generated during encryption"
                      rows={2}
                    />
                  </div>
                  <div className="form-group">
                    <label>Nonce (IV) - Base64 Format</label>
                    <textarea
                      className="crypto-input"
                      value={decryptNonce}
                      onChange={(e) => setDecryptNonce(e.target.value)}
                      placeholder="Enter the Nonce value generated during encryption"
                      rows={2}
                    />
                  </div>
                </>
              )}

              {decryptAlgorithm === 'RSA-2048' && (
                <div className="form-group">
                  <label>Private Key - PEM Format</label>
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
                {decryptAlgorithm === 'AES-256-GCM' && 'The original Key and Nonce values must match exactly to decrypt.'}
                {decryptAlgorithm === 'RSA-2048' && 'If text was encrypted with a public key, it can only be decrypted with the corresponding private key.'}
                {decryptAlgorithm === 'Base64' && 'Converts back to plain text. No additional information needed.'}
              </div>

              <button type="submit" disabled={decryptLoading} className="action-btn decrypt">
                {decryptLoading ? 'Decrypting...' : 'Decrypt'}
              </button>
            </form>

            {decryptResult && (
              <div className="result-container">
                <h4>Decryption Result <span style={{fontSize: '0.8rem', opacity: 0.6}}>({decryptResult.algorithm})</span></h4>
                
                {decryptResult.note && (
                  <div className="result-note">
                    <IconCheck /> {decryptResult.note}
                  </div>
                )}

                <div className="result-item">
                  <label>Original / Decrypted Text</label>
                  <div className="result-box" style={{borderColor: '#b388ff'}}>
                    <code>{decryptResult.decrypted}</code>
                    <button className="copy-btn" onClick={() => copyToClipboard(decryptResult.decrypted, 'decrypted-out')} title="Copy">
                      {copySuccess === 'decrypted-out' ? <IconCheck /> : <IconCopy />}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}