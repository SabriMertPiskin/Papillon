import axios from 'axios';

// =========================================
// Papillon API Service - Centralized Layer
// =========================================

const API = axios.create({
  baseURL: 'http://localhost:8000',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// --- Global 401 Interceptor (Auto Logout) ---
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const isOnLoginPage = window.location.pathname === '/login';
      if (!isOnLoginPage) {
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// =========================================
// AUTH
// =========================================
export const register = (username, email, password, domain = '') =>
  API.post('/auth/register/', { username, email, password, password_confirm: password, domain });

export const login = (email, password) =>
  API.post('/auth/login/', { email, password });

export const logout = () =>
  API.post('/auth/logout/');

export const getDashboard = () =>
  API.get('/auth/dashboard/');

// =========================================
// MFA
// =========================================
export const mfaSetup = () => API.post('/auth/mfa/setup/');
export const mfaVerifySetup = (otp_code) => API.post('/auth/mfa/verify-setup/', { otp_code });
export const verifyMfa = (mfa_token, otp_code, use_backup = false) =>
  API.post('/auth/mfa/verify/', { mfa_token, otp_code, use_backup });
export const mfaDisable = (password) => API.post('/auth/mfa/disable/', { password });
export const mfaStatus = () => API.get('/auth/mfa/status/');

// =========================================
// CRYPTO / ENCRYPTION
// =========================================
export const encryptText = (text, algorithm, key = null) =>
  API.post('/crypto/encrypt/', { text, algorithm, key });

export const decryptText = (ciphertext, algorithm, key = null, nonce = null, private_key = null) =>
  API.post('/crypto/decrypt/', { ciphertext, algorithm, key, nonce, private_key });

// =========================================
// CVE
// =========================================
export const getLatestCVEs = (limit = 10) =>
  API.get(`/cve/latest/?limit=${limit}`);

// =========================================
// ATTACK SURFACE
// =========================================
export const attackSurfaceScan = (domain) =>
  API.post('/attack-surface/scan/', { domain });

// =========================================
// OUTLOOK
// =========================================
export const outlookStatus = () => API.get('/outlook/status');
export const outlookSaveClientId = (client_id, client_secret) =>
  API.post('/outlook/save-client-id', { client_id, client_secret });
export const outlookAuthorize = () => API.get('/outlook/authorize');
export const outlookDisconnect = () => API.post('/outlook/disconnect');
export const outlookLatestMail = () => API.get('/outlook/latest-mail');

// =========================================
// VM LAB
// =========================================
export const vmLabStatus = () => API.get('/vm-lab/status');
export const vmLabStart = () => API.post('/vm-lab/start');
export const vmLabTerminate = () => API.post('/vm-lab/terminate');

// =========================================
// AI MODULES
// =========================================
export const predictPasswordStrength = (password) =>
  API.post('/ai/password-strength/predict/', { password });

export const predictPhishing = (email_text, sender = '', subject = '') =>
  API.post('/ai/phishing/predict/', { email_text, sender, subject });

export const getPhishingHistory = (status = '', search = '') =>
  API.get(`/ai/phishing/history/?status=${status}&search=${search}`);

// Network IDS AI endpoints
export const predictIntrusion = (features) =>
  API.post('/ai/network-ids/predict/', { features });

export const analyzeNetworkBatch = (samples) =>
  API.post('/ai/network-ids/analyze-batch/', { samples });

export const monitorNetworkSnapshot = (domain) =>
  API.post('/ai/network-ids/monitor-snapshot/', { domain });

export const analyzeMalware = (formData) =>
  API.post('/ai/malware/analyze/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });

// =========================================
// BLACKLIST
// =========================================
export const getBlacklist = () => API.get('/blacklist/');
export const addBlacklist = (ip_address, reason = '') =>
  API.post('/blacklist/', { ip_address, reason });
export const deleteBlacklist = (id) => API.delete(`/blacklist/${id}/`);

export default API;