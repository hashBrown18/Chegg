import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[CHEGG] Render error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: '#000',
          color: '#fff',
          fontFamily: "'Space Grotesk', sans-serif",
          textAlign: 'center',
          padding: '2rem',
        }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Something went wrong</h1>
          <p style={{ color: '#A0A0B0', marginBottom: '2rem' }}>
            The application encountered an unexpected error.
          </p>
          <button
            onClick={() => window.location.assign('/')}
            style={{
              padding: '12px 24px',
              background: '#D6B9FC',
              border: 'none',
              borderRadius: '8px',
              color: '#1a0a2e',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Return Home
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
