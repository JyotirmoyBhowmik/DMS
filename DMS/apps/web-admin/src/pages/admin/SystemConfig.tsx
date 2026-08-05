import React, { useState, useEffect } from 'react';
import type { UserRole, ConfigFlag } from '../../types';
import { dbService } from '../../services/dbService';

export const SystemConfig: React.FC<{ role: UserRole }> = ({ role: _role }) => {
  const [flags, setFlags] = useState<ConfigFlag[]>([]);

  useEffect(() => {
    dbService.getConfigFlags().then(setFlags);
  }, []);

  const toggleFlag = (key: string) => {
    setFlags(flags.map((f: ConfigFlag) => f.key === key ? { ...f, enabled: !f.enabled } : f));
  };

  const containerStyle: React.CSSProperties = { padding: '24px', backgroundColor: '#F8FAFC', minHeight: '100vh', color: '#334155' };
  const headerStyle: React.CSSProperties = { fontSize: '24px', fontWeight: 'bold', color: '#0F172A', marginBottom: '24px' };
  const listStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '16px' };
  const cardStyle: React.CSSProperties = { backgroundColor: '#FFFFFF', padding: '20px', borderRadius: '8px', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
  
  return (
    <div style={containerStyle}>
      <h1 style={headerStyle}>System Configuration</h1>
      <div style={listStyle}>
        {flags.map((flag: ConfigFlag) => (
          <div key={flag.key} style={cardStyle}>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#0F172A', marginBottom: '4px' }}>{flag.key}</div>
              <div style={{ color: '#64748B', fontSize: '14px' }}>{flag.description}</div>
            </div>
            <button 
              onClick={() => toggleFlag(flag.key)}
              style={{
                backgroundColor: flag.enabled ? '#DCFCE7' : '#F1F5F9',
                color: flag.enabled ? '#15803D' : '#64748B',
                border: flag.enabled ? '1px solid #15803D' : '1px solid #CBD5E1',
                padding: '6px 12px',
                borderRadius: '16px',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              {flag.enabled ? 'ENABLED' : 'DISABLED'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
