import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();

  React.useEffect(() => {
    const theme = localStorage.getItem('papillon-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--auth-bg-primary, #0a1628)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Inter', system-ui, sans-serif",
      color: 'var(--auth-text-primary, #e8edf5)',
      padding: '20px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 500, height: 500, borderRadius: '50%',
        background: 'rgba(30, 136, 229, 0.07)', filter: 'blur(100px)', pointerEvents: 'none',
      }} />

      {/* 404 Number */}
      <div style={{
        fontSize: 'clamp(80px, 20vw, 160px)',
        fontWeight: 900,
        lineHeight: 1,
        background: 'linear-gradient(135deg, rgba(30,136,229,0.4), rgba(0,188,212,0.2))',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        marginBottom: 8,
        userSelect: 'none',
        letterSpacing: '-4px',
        position: 'relative', zIndex: 1,
      }}>
        404
      </div>

      {/* Shield Icon */}
      <div style={{
        width: 60, height: 60, borderRadius: 16,
        background: 'rgba(30, 136, 229, 0.12)',
        border: '1px solid rgba(30, 136, 229, 0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 20,
        color: 'rgba(30, 136, 229, 0.7)',
        position: 'relative', zIndex: 1,
      }}>
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      </div>

      <h1 style={{
        fontSize: '1.6rem', fontWeight: 700, margin: '0 0 10px',
        textAlign: 'center', position: 'relative', zIndex: 1,
      }}>
        Page Not Found
      </h1>

      <p style={{
        fontSize: '1rem', color: 'var(--auth-text-secondary, #8899b4)',
        margin: '0 0 32px', textAlign: 'center', maxWidth: 400,
        lineHeight: 1.6, position: 'relative', zIndex: 1,
      }}>
        The page you're looking for doesn't exist or may have been moved.
      </p>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            padding: '14px 28px',
            background: 'linear-gradient(135deg, #1e88e5, #00bcd4)',
            border: 'none', borderRadius: 12,
            color: '#fff', fontSize: '0.95rem', fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 15px rgba(30, 136, 229, 0.3)',
          }}
          onMouseEnter={e => { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 8px 20px rgba(30,136,229,0.4)'; }}
          onMouseLeave={e => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = '0 4px 15px rgba(30,136,229,0.3)'; }}
        >
          ← Dashboard
        </button>

        <button
          onClick={() => navigate(-1)}
          style={{
            padding: '14px 28px',
            background: 'rgba(15, 25, 50, 0.6)',
            border: '1px solid rgba(30, 136, 229, 0.2)',
            borderRadius: 12,
            color: 'var(--auth-text-primary, #e8edf5)',
            fontSize: '0.95rem', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
            transition: 'all 0.3s ease',
          }}
          onMouseEnter={e => { e.target.style.borderColor = '#1e88e5'; e.target.style.color = '#1e88e5'; }}
          onMouseLeave={e => { e.target.style.borderColor = 'rgba(30,136,229,0.2)'; e.target.style.color = 'var(--auth-text-primary, #e8edf5)'; }}
        >
          Go Back
        </button>
      </div>

      {/* Decorative code-style text */}
      <p style={{
        position: 'absolute', bottom: 32,
        fontFamily: 'monospace', fontSize: '0.8rem',
        color: 'rgba(30, 136, 229, 0.25)',
        letterSpacing: 1,
        userSelect: 'none',
      }}>
        ERROR 404 · PAPILLON SECURITY PLATFORM
      </p>
    </div>
  );
}
