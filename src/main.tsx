import React, { Component, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// ── Error Boundary: prevents blank white screen on React crashes ──────────────
class ErrorBoundary extends React.Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ThoughtCanvas] Runtime error:', error, info);
  }

  render() {
    if ((this as any).state.error) {
      return (
        <div style={{
          width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', background: '#F5F5F7',
          fontFamily: 'Inter, sans-serif', gap: '16px', padding: '32px', boxSizing: 'border-box'
        }}>
          <div style={{ fontSize: '32px' }}>⚠️</div>
          <h1 style={{ fontSize: '18px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '2px', margin: 0 }}>
            ThoughtCanvas encountered an error
          </h1>
          <p style={{ fontSize: '12px', color: '#666', textAlign: 'center', maxWidth: '400px', margin: 0 }}>
            {String((this as any).state.error.message || (this as any).state.error)}
          </p>
          <button
            onClick={() => { (this as any).setState({ error: null }); window.location.reload(); }}
            style={{
              padding: '10px 24px', background: '#2563EB', color: '#fff',
              border: '2px solid #000', fontWeight: 900, fontSize: '11px',
              textTransform: 'uppercase', letterSpacing: '2px', cursor: 'pointer',
              boxShadow: '3px 3px 0 #000'
            }}
          >
            Reload App
          </button>
        </div>
      );
    }
    return (this as any).props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
