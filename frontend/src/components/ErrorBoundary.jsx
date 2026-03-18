import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--auth-bg-primary, #0a1628)',
          color: 'var(--auth-text-primary, #e8edf5)',
          fontFamily: "'Inter', sans-serif",
          padding: '40px',
          textAlign: 'center'
        }}>
          <div style={{
            background: 'rgba(244, 67, 54, 0.1)',
            border: '1px solid rgba(244, 67, 54, 0.3)',
            borderRadius: '16px',
            padding: '40px',
            maxWidth: '600px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
          }}>
            <h1 style={{ color: '#ef5350', margin: '0 0 16px', fontSize: '2rem' }}>An Unexpected Error Occurred</h1>
            <p style={{ color: 'var(--auth-text-secondary)', marginBottom: '24px' }}>
              A critical error occurred while the application was running. This may be temporary. Please try refreshing the page.
            </p>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
              <button 
                onClick={() => window.location.reload()}
                style={{
                  padding: '12px 24px',
                  background: '#1e88e5',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}>
                Refresh Page
              </button>
              <button 
                onClick={() => window.location.href = '/dashboard'}
                style={{
                  padding: '12px 24px',
                  background: 'rgba(255,255,255,0.1)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}>
                Back to Dashboard
              </button>
            </div>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details style={{ marginTop: '30px', textAlign: 'left', background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '8px', overflowX: 'auto' }}>
                <summary style={{ cursor: 'pointer', color: '#ef5350', fontWeight: 'bold' }}>Error Details (Developer Mode Only)</summary>
                <pre style={{ color: '#ff8a80', fontSize: '0.85rem', marginTop: '10px' }}>
                  {this.state.error.toString()}
                  <br />
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;
