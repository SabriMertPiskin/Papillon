import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Register from './pages/Register';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import OutlookIntegration from './pages/OutlookIntegration';
import CVEList from './pages/CVEList';
import Encryption from './pages/Encryption';
import OutlookCallback from './pages/OutlookCallback';
import AttackSurfaceAnalysis from './pages/AttackSurfaceAnalysis';
import PasswordStrength from './pages/PasswordStrength';
import Blacklist from './pages/Blacklist';
import UserProfile from './pages/UserProfile';
import NetworkTraffic from './pages/NetworkTraffic';
import CPanelData from './pages/CPanelData';
import AsyncTaskExample from './pages/AsyncTaskExample';
import VMLab from './pages/VMLab';
import SSHVMLab from './pages/SSHVMLab';
import MalwareAnalysis from './pages/MalwareAnalysis';
import PhishingHistory from './pages/PhishingHistory';
import VulnerabilityMap from './pages/VulnerabilityMap';
import NotFound from './pages/NotFound';
import ErrorBoundary from './components/ErrorBoundary';
import { AsyncEventBusProvider } from './contexts/AsyncEventBus';
import './App.css';
import './styles/ModuleUnified.css';

function App() {
  const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';

  return (
    <ErrorBoundary>
      <AsyncEventBusProvider>
        <Router>
          <Routes>
            {/* Auth routes */}
            <Route path="/register" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Register />} />
            <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />} />

        {/* Protected routes */}
        <Route path="/dashboard" element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" replace />} />
        <Route path="/outlook-integration" element={isAuthenticated ? <OutlookIntegration /> : <Navigate to="/login" replace />} />
        <Route path="/cve" element={isAuthenticated ? <CVEList /> : <Navigate to="/login" replace />} />
        <Route path="/encryption" element={isAuthenticated ? <Encryption /> : <Navigate to="/login" replace />} />
        <Route path="/attack-surface" element={isAuthenticated ? <AttackSurfaceAnalysis /> : <Navigate to="/login" replace />} />
        <Route path="/password-strength" element={isAuthenticated ? <PasswordStrength /> : <Navigate to="/login" replace />} />
        <Route path="/blacklist" element={isAuthenticated ? <Blacklist /> : <Navigate to="/login" replace />} />
        <Route path="/profile" element={isAuthenticated ? <UserProfile /> : <Navigate to="/login" replace />} />
        <Route path="/network-traffic" element={isAuthenticated ? <NetworkTraffic /> : <Navigate to="/login" replace />} />
        <Route path="/cpanel-data" element={isAuthenticated ? <CPanelData /> : <Navigate to="/login" replace />} />
        <Route path="/vm-lab" element={isAuthenticated ? <VMLab /> : <Navigate to="/login" replace />} />
        <Route path="/ssh-vm-lab" element={isAuthenticated ? <SSHVMLab /> : <Navigate to="/login" replace />} />
        <Route path="/malware-analysis" element={isAuthenticated ? <MalwareAnalysis /> : <Navigate to="/login" replace />} />
        <Route path="/phishing-history" element={isAuthenticated ? <PhishingHistory /> : <Navigate to="/login" replace />} />
        <Route path="/vulnerability-map" element={isAuthenticated ? <VulnerabilityMap /> : <Navigate to="/login" replace />} />
        
        {/* Async Task Example / Demo */}
        <Route path="/async-demo" element={isAuthenticated ? <AsyncTaskExample /> : <Navigate to="/login" replace />} />

        {/* Redirect MFA settings to profile */}
        <Route path="/mfa-settings" element={<Navigate to="/profile" replace />} />

        {/* Outlook OAuth callback (public) */}
        <Route path="/outlook/callback" element={<OutlookCallback />} />

        {/* Default & 404 */}
        <Route path="/" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
        </Router>
      </AsyncEventBusProvider>
    </ErrorBoundary>
  );
}

export default App;
