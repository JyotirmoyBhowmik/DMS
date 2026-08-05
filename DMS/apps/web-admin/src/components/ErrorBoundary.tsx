import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled React Error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            backgroundColor: '#0F172A',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "'Inter', system-ui, sans-serif",
            padding: '24px',
          }}
        >
          <div
            style={{
              backgroundColor: '#1E293B',
              borderRadius: '16px',
              padding: '36px',
              maxWidth: '500px',
              width: '100%',
              border: '1px solid #334155',
              boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                backgroundColor: '#FEF2F2',
                color: '#B91C1C',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                margin: '0 auto 16px',
              }}
            >
              ⚠️
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: '700', margin: '0 0 8px', color: '#F8FAFC' }}>
              Application Recovery Mode
            </h2>
            <p style={{ fontSize: '13px', color: '#94A3B8', margin: '0 0 20px', lineHeight: 1.6 }}>
              A temporary runtime error occurred while loading database resources.
            </p>
            <div
              style={{
                backgroundColor: '#0F172A',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '11px',
                fontFamily: 'monospace',
                color: '#FCA5A5',
                textAlign: 'left',
                marginBottom: '24px',
                wordBreak: 'break-word',
              }}
            >
              {this.state.error?.message || 'Unknown render error'}
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => {
                  localStorage.clear();
                  window.location.reload();
                }}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#2563EB',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '13px',
                }}
              >
                🔄 Clear Cache & Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
