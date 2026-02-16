import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:8000/auth',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const register = (username, email, password, domain = '') => {
  return API.post('/register/', {
    username,
    email,
    password,
    password_confirm: password,
    domain,
  });
};

export const login = (email, password) => {
  return API.post('/login/', { email, password });
};

export const logout = () => {
  return API.post('/logout/');
};

export const getDashboard = () => {
  return API.get('/dashboard/');
};

// MFA endpoints
export const mfaSetup = () => {
  return API.post('/mfa/setup/');
};

export const mfaVerifySetup = (otp_code) => {
  return API.post('/mfa/verify-setup/', { otp_code });
};

export const verifyMfa = (mfa_token, otp_code, use_backup = false) => {
  return API.post('/mfa/verify/', { mfa_token, otp_code, use_backup });
};

export const mfaDisable = (password) => {
  return API.post('/mfa/disable/', { password });
};

export const mfaStatus = () => {
  return API.get('/mfa/status/');
};

export default API;