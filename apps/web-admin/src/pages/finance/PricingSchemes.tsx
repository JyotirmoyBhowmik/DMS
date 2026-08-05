import React, { useState } from 'react';
import type { UserRole, TradeScheme } from '../../types';
import { useData } from '../../context/DataContext';
import { StatusBadge } from '../../components/StatusBadge';
import { Modal } from '../../components/Modal';
import { FormField } from '../../components/FormField';
import { tokens } from '../../theme/tokens';

export const PricingSchemes: React.FC<{ role: UserRole }> = ({ role }) => {
  const { tradeSchemes } = useData();
  const [showForm, setShowForm] = useState(false);
  const [schemeName, setSchemeName] = useState('');
  const [minQty, setMinQty] = useState('10');
  const [reward, setReward] = useState('5% Off Invoice');
  const [validUntil, setValidUntil] = useState('2026-12-31');

  const canCreate = role === 'admin';

  return (
    <div style={{ padding: '24px', backgroundColor: tokens.colors.bgApp, minHeight: '100vh', color: tokens.colors.textBody }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: tokens.colors.textMain, margin: 0 }}>Pricing & Scheme Control</h1>
          <p style={{ color: tokens.colors.textMuted, margin: '4px 0 0', fontSize: '14px' }}>
            Trade promotions, volume discounts & distributor pricing rules ({tradeSchemes.length} active)
          </p>
        </div>

        {canCreate && (
          <button style={tokens.presets.buttonPrimary} onClick={() => setShowForm(true)}>
            + Create Trade Scheme
          </button>
        )}
      </div>

      <div style={{ backgroundColor: '#FFFFFF', border: `1px solid ${tokens.colors.border}`, borderRadius: '8px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: `1px solid ${tokens.colors.border}` }}>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: tokens.colors.textBody, fontSize: '13px' }}>Scheme Name</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: tokens.colors.textBody, fontSize: '13px' }}>Scheme Type</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: tokens.colors.textBody, fontSize: '13px' }}>Min Qty Required</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: tokens.colors.textBody, fontSize: '13px' }}>Promotional Reward</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: tokens.colors.textBody, fontSize: '13px' }}>Valid Until</th>
            </tr>
          </thead>
          <tbody>
            {tradeSchemes.map((scheme: TradeScheme, idx: number) => (
              <tr key={scheme.id} style={{ borderBottom: idx === tradeSchemes.length - 1 ? 'none' : `1px solid ${tokens.colors.border}` }}>
                <td style={{ padding: '12px 16px', fontWeight: 600, color: tokens.colors.textMain }}>{scheme.name}</td>
                <td style={{ padding: '12px 16px' }}>
                  <StatusBadge status={scheme.type} />
                </td>
                <td style={{ padding: '12px 16px', fontWeight: 600 }}>{scheme.minQty} units</td>
                <td style={{ padding: '12px 16px', color: tokens.colors.brand, fontWeight: 600 }}>{scheme.reward}</td>
                <td style={{ padding: '12px 16px', color: tokens.colors.textMuted, fontSize: '12px' }}>{scheme.validUntil}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal title="Create Trade Promotion Scheme" subtitle="Configure pricing discounts & distributor volume rewards" isOpen={showForm} onClose={() => setShowForm(false)}>
        <form onSubmit={(e) => { e.preventDefault(); setShowForm(false); }} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <FormField label="Scheme Name">
            <input type="text" value={schemeName} onChange={(e) => setSchemeName(e.target.value)} placeholder="e.g. Monsoon Bulk Discount" style={tokens.presets.input} required />
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <FormField label="Min Order Quantity">
              <input type="number" value={minQty} onChange={(e) => setMinQty(e.target.value)} style={tokens.presets.input} required />
            </FormField>
            <FormField label="Valid Until">
              <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} style={tokens.presets.input} required />
            </FormField>
          </div>
          <FormField label="Promotional Reward">
            <input type="text" value={reward} onChange={(e) => setReward(e.target.value)} style={tokens.presets.input} required />
          </FormField>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
            <button type="button" onClick={() => setShowForm(false)} style={tokens.presets.buttonSecondary}>Cancel</button>
            <button type="submit" style={tokens.presets.buttonPrimary}>Save Scheme</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
