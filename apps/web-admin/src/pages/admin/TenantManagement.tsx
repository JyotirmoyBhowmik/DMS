import React, { useState } from 'react';
import { UserRole } from '../../types';
import { useData } from '../../context/DataContext';
import { StatusBadge } from '../../components/StatusBadge';
import { tokens } from '../../theme/tokens';
import { Modal } from '../../components/Modal';
import { FormField } from '../../components/FormField';

export const TenantManagement: React.FC<{ role: UserRole }> = ({ role: _role }) => {
  const { tenants, addTenant } = useData();
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    addTenant({ name, domain });
    setName('');
    setDomain('');
    setShowModal(false);
  };

  return (
    <div style={{ padding: '24px', backgroundColor: tokens.colors.bgApp, minHeight: '100vh', color: tokens.colors.textBody }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: tokens.colors.textMain, margin: 0 }}>Multi-Tenant Isolation</h1>
          <p style={{ color: tokens.colors.textMuted, margin: '4px 0 0', fontSize: '14px' }}>
            Managed tenant organizations & Postgres Row-Level Security domains
          </p>
        </div>
        <button style={tokens.presets.buttonPrimary} onClick={() => setShowModal(true)}>
          + Onboard New Tenant
        </button>
      </div>

      <div style={{ backgroundColor: '#FFFFFF', border: `1px solid ${tokens.colors.border}`, borderRadius: '8px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: `1px solid ${tokens.colors.border}` }}>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: tokens.colors.textBody, fontSize: '13px' }}>Tenant ID</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: tokens.colors.textBody, fontSize: '13px' }}>Organization Name</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: tokens.colors.textBody, fontSize: '13px' }}>Domain</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: tokens.colors.textBody, fontSize: '13px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((t, idx) => (
              <tr key={t.id} style={{ borderBottom: idx === tenants.length - 1 ? 'none' : `1px solid ${tokens.colors.border}` }}>
                <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 600 }}>{t.id}</td>
                <td style={{ padding: '12px 16px', fontWeight: 600, color: tokens.colors.textMain }}>{t.name}</td>
                <td style={{ padding: '12px 16px', color: tokens.colors.brand }}>{t.domain}</td>
                <td style={{ padding: '12px 16px' }}><StatusBadge status={t.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal title="Onboard New Tenant Organization" subtitle="Provision tenant record & Postgres RLS context" isOpen={showModal} onClose={() => setShowModal(false)}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <FormField label="Organization Name">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Pacific Logistics Corp"
              style={tokens.presets.input}
              required
            />
          </FormField>
          <FormField label="Domain Name">
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="pacific.dms.com"
              style={tokens.presets.input}
              required
            />
          </FormField>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
            <button type="button" onClick={() => setShowModal(false)} style={tokens.presets.buttonSecondary}>Cancel</button>
            <button type="submit" style={tokens.presets.buttonPrimary}>Onboard Tenant</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
