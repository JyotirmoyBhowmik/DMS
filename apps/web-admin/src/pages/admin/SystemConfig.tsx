import React from 'react';
import type { UserRole, ConfigFlag } from '../../types';
import { useData } from '../../context/DataContext';
import { tokens } from '../../theme/tokens';

export const SystemConfig: React.FC<{ role: UserRole }> = ({ role: _role }) => {
  const { configFlags, toggleConfigFlag } = useData();

  const enabledCount = configFlags.filter((f: ConfigFlag) => f.enabled).length;

  return (
    <div style={{ padding: '24px', backgroundColor: tokens.colors.bgApp, minHeight: '100vh', color: tokens.colors.textBody }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: tokens.colors.textMain, margin: 0 }}>System Configuration</h1>
          <p style={{ color: tokens.colors.textMuted, margin: '4px 0 0', fontSize: '14px' }}>
            {enabledCount}/{configFlags.length} feature flags enabled
          </p>
        </div>
      </div>
      {configFlags.length === 0 ? (
        <div style={{ backgroundColor: '#FFFFFF', padding: '24px', borderRadius: '8px', border: `1px solid ${tokens.colors.border}` }}>
          <p style={{ color: tokens.colors.textMuted, fontSize: '14px', margin: 0 }}>No feature flags configured in database.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {configFlags.map((flag: ConfigFlag) => (
            <div key={flag.key} style={{
              backgroundColor: '#FFFFFF', padding: '20px', borderRadius: '8px',
              border: `1px solid ${tokens.colors.border}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '16px', color: tokens.colors.textMain, marginBottom: '4px' }}>{flag.key}</div>
                <div style={{ color: tokens.colors.textMuted, fontSize: '14px' }}>{flag.description}</div>
              </div>
              <button
                onClick={() => toggleConfigFlag(flag.key)}
                style={{
                  backgroundColor: flag.enabled ? tokens.colors.successBg : '#F1F5F9',
                  color: flag.enabled ? tokens.colors.success : tokens.colors.textMuted,
                  border: flag.enabled ? `1px solid ${tokens.colors.successBorder}` : `1px solid ${tokens.colors.border}`,
                  padding: '6px 12px', borderRadius: '16px', fontWeight: 600,
                  cursor: 'pointer', fontSize: '12px',
                }}
              >
                {flag.enabled ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
