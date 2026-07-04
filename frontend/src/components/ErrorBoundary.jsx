import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Caught runtime error:', error);
    console.error('[ErrorBoundary] Component stack:', info?.componentStack);
    this.setState({ info });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          background: '#0f172a',
          color: '#f87171',
          fontFamily: 'monospace',
          padding: '2rem',
          minHeight: '200px',
          border: '1px solid #dc2626',
          borderRadius: '8px',
          margin: '1rem'
        }}>
          <h2 style={{ color: '#fca5a5', marginBottom: '1rem', fontSize: '14px', fontWeight: 'bold' }}>
            ⚠ RUNTIME ERROR — Component crashed
          </h2>
          <pre style={{ fontSize: '11px', whiteSpace: 'pre-wrap', color: '#f87171', marginBottom: '1rem' }}>
            {this.state.error?.toString()}
          </pre>
          <pre style={{ fontSize: '10px', color: '#94a3b8', whiteSpace: 'pre-wrap' }}>
            {this.state.info?.componentStack}
          </pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null, info: null })}
            style={{
              marginTop: '1rem', background: '#1e293b', color: '#94a3b8',
              border: '1px solid #334155', padding: '6px 12px', borderRadius: '4px',
              cursor: 'pointer', fontSize: '11px'
            }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
