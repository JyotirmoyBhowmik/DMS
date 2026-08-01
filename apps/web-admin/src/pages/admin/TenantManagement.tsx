import React, { useState } from 'react';
import { UserRole } from '../../types';
import { SEED_TENANTS } from '../../data/seed';

interface TenantManagementProps {
  role: UserRole;
}

export const TenantManagement: React.FC<TenantManagementProps> = ({ role }) => {
  const [tenants, setTenants] = useState(SEED_TENANTS);
  const [showForm, setShowForm] = useState(false);

  const containerStyle: React.CSSProperties = { padding: '24px', backgroundColor: '#F8FAFC', minHeight: '100vh', color: '#334155' };
  const headerStyle: React.CSSProperties = { fontSize: '24px', fontWeight: 'bold', color: '#0F172A' };
  const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', backgroundColor: '#FFFFFF', borderRadius: '8px', overflow: 'hidden', border: '1px solid #E2E8F0', marginTop: '24px' };
  const thStyle: React.CSSProperties = { padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#64748B', fontWeight: 600, fontSize: '14px' };
  const tdStyle: React.CSSProperties = { padding: '12px 16px', borderBottom: '1px solid #E2E8F0', fontSize: '14px' };
  const monoStyle: React.CSSProperties = { fontFamily: 'monospace', color: '#475569' };
  const buttonStyle: React.CSSProperties = { backgroundColor: '#2563EB', color: '#FFFFFF', padding: '8px 16px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 };
  const formStyle: React.CSSProperties = { backgroundColor: '#FFFFFF', padding: '20px', borderRadius: '8px', border: '1px solid #E2E8F0', marginTop: '24px' };

  return (
    <div style={containerStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={headerStyle}>Tenant Management</h1>
        <button style={buttonStyle} onClick={() => setShowForm(!showForm)}>+ Onboard Tenant</button>
      </div>

      {showForm && (
        <div style={formStyle}>
          <h3 style={{ marginTop: 0, color: '#0F172A' }}>New Tenant Onboarding</h3>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            <input placeholder="Organization Name" style={{ padding: '8px', borderRadius: '4px', border: '1px solid #E2E8F0', flex: 1 }} />
            <input placeholder="Domain" style={{ padding: '8px', borderRadius: '4px', border: '1px solid #E2E8F0', flex: 1 }} />
          </div>
          <button style={buttonStyle} onClick={() => setShowForm(false)}>Submit</button>
        </div>
      )}

      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Tenant ID</th><th style={thStyle}>Organization Name</th><th style={thStyle}>Domain</th><th style={thStyle}>Status</th>
          </tr>
        </thead>
        <tbody>
          {tenants.map(t => (
            <tr key={t.id}>
              <td style={{ ...tdStyle, ...monoStyle }}>{t.id}</td>
              <td style={tdStyle}>{t.name}</td>
              <td style={tdStyle}>{t.domain}</td>
              <td style={tdStyle}>
                <span style={{ color: t.status === 'ACTIVE' ? '#15803D' : '#64748B', fontWeight: 500 }}>{t.status.toUpperCase()}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
