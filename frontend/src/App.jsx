import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Register from './pages/Register';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CVEList from './pages/CVEList';
import Encryption from './pages/Encryption';
import OutlookCallback from './pages/OutlookCallback';
import MFASettings from './pages/MFASettings';
import AttackSurfaceAnalysis from './pages/AttackSurfaceAnalysis';
import PasswordStrength from './pages/PasswordStrength';
import Blacklist from './pages/Blacklist';
import UserProfile from './pages/UserProfile';
import NetworkTraffic from './pages/NetworkTraffic';
import MalwareAnalysis from './pages/MalwareAnalysis';
import PhishingHistory from './pages/PhishingHistory';
import VulnerabilityMap from './pages/VulnerabilityMap';
import NotFound from './pages/NotFound';
import ErrorBoundary from './components/ErrorBoundary';
import './App.css';

function App() {
  const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';

  return (
    <ErrorBoundary>
      <Router>
      <Routes>
        {/* Auth routes */}
        <Route path="/register" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Register />} />
        <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />} />

        {/* Protected routes */}
        <Route path="/dashboard" element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" replace />} />
        <Route path="/cve" element={isAuthenticated ? <CVEList /> : <Navigate to="/login" replace />} />
        <Route path="/encryption" element={isAuthenticated ? <Encryption /> : <Navigate to="/login" replace />} />
        <Route path="/mfa-settings" element={isAuthenticated ? <MFASettings /> : <Navigate to="/login" replace />} />
        <Route path="/attack-surface" element={isAuthenticated ? <AttackSurfaceAnalysis /> : <Navigate to="/login" replace />} />
        <Route path="/password-strength" element={isAuthenticated ? <PasswordStrength /> : <Navigate to="/login" replace />} />
        <Route path="/blacklist" element={isAuthenticated ? <Blacklist /> : <Navigate to="/login" replace />} />
        <Route path="/profile" element={isAuthenticated ? <UserProfile /> : <Navigate to="/login" replace />} />
        <Route path="/network-traffic" element={isAuthenticated ? <NetworkTraffic /> : <Navigate to="/login" replace />} />
        <Route path="/malware-analysis" element={isAuthenticated ? <MalwareAnalysis /> : <Navigate to="/login" replace />} />
        <Route path="/phishing-history" element={isAuthenticated ? <PhishingHistory /> : <Navigate to="/login" replace />} />
        <Route path="/vulnerability-map" element={isAuthenticated ? <VulnerabilityMap /> : <Navigate to="/login" replace />} />

        {/* Outlook OAuth callback (public) */}
        <Route path="/outlook/callback" element={<OutlookCallback />} />

        {/* Default & 404 */}
        <Route path="/" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
    </ErrorBoundary>
  );
}

export default App;