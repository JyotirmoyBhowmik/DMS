import React from 'react';
import ReactDOM from 'react-dom/client';
import { DesignTokens } from '@dms/pkg-ui-shared';

const App = () => {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: DesignTokens.colors.background,
      color: DesignTokens.colors.text,
      fontFamily: DesignTokens.typography.fontFamily,
      padding: DesignTokens.spacing.lg,
      backgroundImage: 'radial-gradient(circle at 10% 20%, rgba(30, 58, 138, 0.15) 0%, transparent 40%)'
    }}>
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        paddingBottom: DesignTokens.spacing.md,
        marginBottom: DesignTokens.spacing.lg
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#60A5FA' }}>
            Enterprise DMS & SFA Platform
          </h1>
          <p style={{ margin: '4px 0 0 0', opacity: 0.7, fontSize: '13px' }}>
            Central Control & Field Monitoring Dashboard
          </p>
        </div>
        <div style={{
          backgroundColor: 'rgba(255,255,255,0.05)',
          padding: '8px 16px',
          borderRadius: '20px',
          border: '1px solid rgba(255,255,255,0.1)',
          fontSize: '13px'
        }}>
          Tenant: <strong style={{ color: '#10B981' }}>Mock Global Corp</strong>
        </div>
      </header>

      <main>
        <section style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: DesignTokens.spacing.md,
          marginBottom: '32px'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)',
            padding: DesignTokens.spacing.md,
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.05)',
            boxShadow: '0 4px 30px rgba(0, 0, 0, 0.3)',
            backdropFilter: 'blur(5px)'
          }}>
            <h3 style={{ margin: 0, fontSize: '14px', textTransform: 'uppercase', opacity: 0.6, letterSpacing: '0.05em' }}>
              Primary Order Volume
            </h3>
            <div style={{ fontSize: '36px', fontWeight: 'bold', margin: '16px 0 8px 0', color: '#F8FAFC' }}>
              $142,520
            </div>
            <div style={{ fontSize: '12px', color: '#10B981', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>↑ 12.4%</span> <span style={{ opacity: 0.5, color: '#F8FAFC' }}>vs last week</span>
            </div>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)',
            padding: DesignTokens.spacing.md,
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.05)',
            boxShadow: '0 4px 30px rgba(0, 0, 0, 0.3)',
            backdropFilter: 'blur(5px)'
          }}>
            <h3 style={{ margin: 0, fontSize: '14px', textTransform: 'uppercase', opacity: 0.6, letterSpacing: '0.05em' }}>
              Sync Queue Backlog
            </h3>
            <div style={{ fontSize: '36px', fontWeight: 'bold', margin: '16px 0 8px 0', color: '#F59E0B' }}>
              0
            </div>
            <div style={{ fontSize: '12px', color: '#10B981' }}>
              Active Sync Service Online
            </div>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)',
            padding: DesignTokens.spacing.md,
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.05)',
            boxShadow: '0 4px 30px rgba(0, 0, 0, 0.3)',
            backdropFilter: 'blur(5px)'
          }}>
            <h3 style={{ margin: 0, fontSize: '14px', textTransform: 'uppercase', opacity: 0.6, letterSpacing: '0.05em' }}>
              Audit Tamper Integrity
            </h3>
            <div style={{ fontSize: '20px', fontWeight: 'bold', margin: '22px 0 14px 0', color: '#10B981' }}>
              VERIFIED COMPLIANT
            </div>
            <div style={{ fontSize: '12px', opacity: 0.6 }}>
              SOC 2 tampered logs hashchain checks pass
            </div>
          </div>
        </section>

        <section style={{
          background: 'rgba(30, 41, 59, 0.4)',
          borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.05)',
          padding: DesignTokens.spacing.lg
        }}>
          <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#F8FAFC' }}>
            System Infrastructure Status
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
            {['sfa-service', 'dms-core-service', 'identity-service', 'sync-service'].map((svc) => (
              <div key={svc} style={{
                backgroundColor: 'rgba(15, 23, 42, 0.6)',
                padding: '12px 20px',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#10B981',
                  boxShadow: '0 0 8px #10B981'
                }}></span>
                <span style={{ fontSize: '13px', fontWeight: 500 }}>{svc}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

const rootEl = document.getElementById('root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
