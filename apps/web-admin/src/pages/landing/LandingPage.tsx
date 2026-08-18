// ── Landing Page (Pre-Auth) ──

import React, { useState } from 'react';
import type { UserRole } from '../../types';

interface LandingPageProps {
  onLogin: (email: string, password: string, role: UserRole) => void;
  onDemoMode: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLogin, onDemoMode }) => {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [email, setEmail] = useState('admin@enterprise.com');
  const [password, setPassword] = useState('SecureP@ss123!');
  const [selectedRole, setSelectedRole] = useState<UserRole>('admin');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setTimeout(() => {
      onLogin(email, password, selectedRole);
    }, 800);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFC', fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Top Bar */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 40px',
          backgroundColor: '#FFFFFF',
          borderBottom: '1px solid #E2E8F0',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '8px',
            backgroundColor: '#0F172A', color: '#FFFFFF',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: '800', fontSize: '18px',
          }}>
            D
          </div>
          <span style={{ fontWeight: '700', fontSize: '16px', color: '#0F172A' }}>
            DMS & SFA PLATFORM
          </span>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={onDemoMode}
            style={{
              padding: '9px 20px',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              backgroundColor: '#FFFFFF',
              color: '#334155',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '600',
              transition: 'all 0.15s ease',
            }}
          >
            🚀 View Instant Static Demo
          </button>
          <button
            onClick={() => setShowLoginModal(true)}
            style={{
              padding: '9px 20px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#0F172A',
              color: '#FFFFFF',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '600',
              transition: 'all 0.15s ease',
            }}
          >
            Sign In →
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section
        style={{
          paddingTop: '120px',
          paddingBottom: '60px',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 40px' }}>
          <div style={{
            display: 'inline-block', backgroundColor: '#EFF6FF', color: '#1D4ED8',
            padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '700',
            marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '0.5px',
          }}>
            19 Microservices • 29 Platform Nodes • Enterprise-Grade
          </div>
          <h1 style={{
            fontSize: '42px', fontWeight: '800', color: '#0F172A', lineHeight: 1.15,
            marginBottom: '16px', letterSpacing: '-0.02em',
          }}>
            Integrated Distribution<br />
            Management & Sales Force
          </h1>
          <p style={{
            fontSize: '17px', color: '#64748B', maxWidth: '600px', margin: '0 auto 40px',
            lineHeight: 1.6,
          }}>
            End-to-end enterprise platform for FMCG distribution, field force automation,
            trade promotions, invoicing, and AI-powered demand forecasting — with complete
            multi-tenant isolation and offline-first mobile apps.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={() => setShowLoginModal(true)}
              style={{
                padding: '14px 32px', borderRadius: '10px', border: 'none',
                backgroundColor: '#0F172A', color: '#FFFFFF', cursor: 'pointer',
                fontSize: '15px', fontWeight: '700', transition: 'all 0.15s ease',
              }}
            >
              Access Your Dashboard →
            </button>
            <button
              onClick={onDemoMode}
              style={{
                padding: '14px 32px', borderRadius: '10px',
                border: '1.5px solid #CBD5E1', backgroundColor: '#FFFFFF',
                color: '#334155', cursor: 'pointer', fontSize: '15px', fontWeight: '600',
              }}
            >
              Interactive Demo
            </button>
          </div>
        </div>
      </section>

      {/* 3 Pillars Grid */}
      <section style={{ maxWidth: '1100px', margin: '0 auto 60px', padding: '0 40px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
          {[
            {
              icon: '📍',
              title: 'Field Force Automation',
              desc: 'GPS-tracked beat routes, geofenced check-ins, van sales dispatching, merchandising audits, and offline-first mobile sync with AES-256 encryption.',
              stats: 'Beat Routes • Van Sales • Geo Check-Ins',
              color: '#15803D',
              bgColor: '#DCFCE7',
            },
            {
              icon: '📦',
              title: 'Distribution Management',
              desc: 'Master SKU catalog, multi-warehouse stock ledger, batch tracking, distributor hierarchies, outlet-level credit limits, and GRN processing.',
              stats: 'Inventory • Orders • Outlets',
              color: '#1D4ED8',
              bgColor: '#DBEAFE',
            },
            {
              icon: '💰',
              title: 'Finance & Trade Promotions',
              desc: 'Automated invoicing with credit notes, trade scheme management (Buy-X-Get-Y, volume discounts), distributor claim settlement, and GST-ready taxation.',
              stats: 'Invoices • Claims • Pricing',
              color: '#B45309',
              bgColor: '#FEF3C7',
            },
          ].map((pillar) => (
            <div
              key={pillar.title}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                padding: '28px',
                border: '1px solid #E2E8F0',
                transition: 'box-shadow 0.15s ease',
              }}
            >
              <div
                style={{
                  width: '44px', height: '44px', borderRadius: '10px',
                  backgroundColor: pillar.bgColor, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: '22px',
                  marginBottom: '16px',
                }}
              >
                {pillar.icon}
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0F172A', marginBottom: '10px' }}>
                {pillar.title}
              </h3>
              <p style={{ fontSize: '13px', color: '#64748B', lineHeight: 1.6, marginBottom: '16px' }}>
                {pillar.desc}
              </p>
              <div style={{
                fontSize: '11px', fontWeight: '600', color: pillar.color,
                backgroundColor: pillar.bgColor, padding: '4px 10px',
                borderRadius: '4px', display: 'inline-block',
              }}>
                {pillar.stats}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Platform Architecture Bar */}
      <section style={{
        maxWidth: '1100px', margin: '0 auto 60px', padding: '0 40px',
      }}>
        <div style={{
          backgroundColor: '#0F172A', borderRadius: '12px', padding: '28px 32px',
          color: '#FFFFFF',
        }}>
          <div style={{ fontSize: '14px', fontWeight: '700', marginBottom: '16px' }}>
            Platform Architecture
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {[
              'identity-service', 'dms-core-service', 'sfa-service', 'pricing-service',
              'schemes-service', 'finance-service', 'claims-service', 'file-service',
              'notification-service', 'audit-service', 'config-service', 'report-service',
              'integration-service', 'sync-service', 'forecasting-service', 'recommendation-service',
              'ai-service', 'api-gateway', 'ai-gateway-service',
            ].map((s) => (
              <span
                key={s}
                style={{
                  padding: '5px 12px', borderRadius: '6px',
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  fontSize: '11px', fontFamily: 'monospace', fontWeight: '600',
                }}
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          textAlign: 'center', padding: '24px', borderTop: '1px solid #E2E8F0',
          color: '#94A3B8', fontSize: '12px',
        }}
      >
        © 2026 Enterprise DMS & SFA Platform
      </footer>

      {/* Login Modal Overlay */}
      {showLoginModal && (
        <div
          style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, backdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF', borderRadius: '16px',
              padding: '32px', width: '420px', maxWidth: '90vw',
              boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0F172A', margin: 0 }}>
                  Sign In
                </h2>
                <p style={{ fontSize: '13px', color: '#64748B', margin: '4px 0 0' }}>
                  Enterprise DMS & SFA Platform
                </p>
              </div>
              <button
                onClick={() => setShowLoginModal(false)}
                aria-label="Close login modal"
                style={{
                  border: 'none', backgroundColor: '#F1F5F9', cursor: 'pointer',
                  width: '30px', height: '30px', borderRadius: '8px',
                  fontSize: '16px', color: '#64748B',
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleLogin}>
              {/* Email */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: '8px',
                    border: '1px solid #CBD5E1', fontSize: '13px', outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Password */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: '8px',
                    border: '1px solid #CBD5E1', fontSize: '13px', outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Role Selector */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Login As Role
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                  {(['admin', 'agent', 'distributor', 'auditor'] as UserRole[]).map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setSelectedRole(role)}
                      style={{
                        padding: '8px 4px',
                        borderRadius: '8px',
                        border: selectedRole === role ? '2px solid #0F172A' : '1px solid #E2E8F0',
                        backgroundColor: selectedRole === role ? '#F1F5F9' : '#FFFFFF',
                        color: selectedRole === role ? '#0F172A' : '#64748B',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: selectedRole === role ? '700' : '500',
                        textTransform: 'uppercase',
                      }}
                    >
                      {role}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: '11px', color: '#15803D', marginTop: '6px', fontWeight: '500' }}>
                  {selectedRole === 'admin' && '✓ Full platform access — all modules & configuration'}
                  {selectedRole === 'agent' && '✓ Field SFA view — beats, visits, van sales, my orders'}
                  {selectedRole === 'distributor' && '✓ Distributor portal — my stock, invoices, claims'}
                  {selectedRole === 'auditor' && '✓ Read-only audit view — all data, no write actions'}
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoggingIn}
                style={{
                  width: '100%', padding: '12px', borderRadius: '10px',
                  border: 'none', backgroundColor: '#0F172A', color: '#FFFFFF',
                  cursor: isLoggingIn ? 'wait' : 'pointer',
                  fontSize: '14px', fontWeight: '700',
                  opacity: isLoggingIn ? 0.7 : 1,
                }}
              >
                {isLoggingIn ? '⏳ Authenticating...' : 'Sign In'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
