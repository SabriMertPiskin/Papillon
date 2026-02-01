import axios from 'axios';

const API = axios.create({
  baseURL: 'http://127.0.0.1:8000/auth',
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

export default API;