import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function OutlookCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('Processing...');

  useEffect(() => {
    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const error = params.get('error');

      if (error) {
        setStatus(`Error: ${error}`);
        setTimeout(() => navigate('/login'), 2000);
        return;
      }

      if (!code) {
        setStatus('Authorization code could not be retrieved.');
        setTimeout(() => navigate('/login'), 2000);
        return;
      }

      try {
        // Send code to backend callback endpoint
        const response = await axios.get(`http://localhost:8000/outlook/callback?code=${code}`, {
          withCredentials: true
        });

        if (response.data.success) {
          setStatus("Outlook connected successfully. Redirecting to Dashboard...");
          // Redirect immediately
          window.location.href = '/dashboard';
        } else {
          setStatus(`Error: ${response.data.detail}`);
          setTimeout(() => navigate('/login'), 2000);
        }
      } catch (error) {
        console.error('Callback error:', error);
        setStatus('Connection error. Please try again.');
        setTimeout(() => navigate('/login'), 2000);
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      fontFamily: 'Arial, sans-serif',
      color: 'white'
    }}>
      <div style={{
        textAlign: 'center',
        padding: '40px',
        background: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '10px'
      }}>
        <h2>{status}</h2>
        <div style={{ marginTop: '20px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid white',
            borderRadius: '50%',
            borderTop: '4px solid transparent',
            animation: 'spin 1s linear infinite',
            margin: '0 auto'
          }}></div>
        </div>
      </div>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
