import React, { useState } from 'react';
import { UserRole } from '../../types';
import { useData } from '../../context/DataContext';
import { StatusBadge } from '../../components/StatusBadge';
import { DISTRIBUTOR_NAMES } from '../../data/seed';
import { Modal } from '../../components/Modal';
import { FormField } from '../../components/FormField';
import { tokens } from '../../theme/tokens';

export const TradeClaims: React.FC<{ role: UserRole }> = ({ role }) => {
  const { tradeClaims, tradeSchemes, addTradeClaim, approveTradeClaim } = useData();
  const [showModal, setShowModal] = useState(false);
  const [distributor, setDistributor] = useState(DISTRIBUTOR_NAMES[0]);
  const [scheme, setScheme] = useState(tradeSchemes[0]?.name || 'Monsoon Oil Bulk Promotion');
  const [amount, setAmount] = useState('1800.00');

  const canApprove = role === 'admin';
  const canSubmit = role === 'distributor' || role === 'admin';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(amount) || 0;
    addTradeClaim({
      distributor,
      scheme,
      amount: `$${num.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    });
    setShowModal(false);
  };

  return (
    <div style={{ padding: '24px', backgroundColor: tokens.colors.bgApp, minHeight: '100vh', color: tokens.colors.textBody }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: tokens.colors.textMain, margin: 0 }}>Distributor Trade Claims</h1>
          <p style={{ color: tokens.colors.textMuted, margin: '4px 0 0', fontSize: '14px' }}>
            Promotion claim submission, audit verification & financial settlement
          </p>
        </div>

        {canSubmit && (
          <button style={tokens.presets.buttonPrimary} onClick={() => setShowModal(true)}>
            + Submit Trade Claim
          </button>
        )}
      </div>

      <div style={{ backgroundColor: '#FFFFFF', border: `1px solid ${tokens.colors.border}`, borderRadius: '8px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: `1px solid ${tokens.colors.border}` }}>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: tokens.colors.textBody, fontSize: '13px' }}>Claim ID</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: tokens.colors.textBody, fontSize: '13px' }}>Distributor Partner</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: tokens.colors.textBody, fontSize: '13px' }}>Promotion Scheme</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: tokens.colors.textBody, fontSize: '13px' }}>Claim Amount</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: tokens.colors.textBody, fontSize: '13px' }}>Status</th>
              {canApprove && <th style={{ padding: '12px 16px', fontWeight: 600, color: tokens.colors.textBody, fontSize: '13px' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {tradeClaims.map((clm, idx) => (
              <tr key={clm.id} style={{ borderBottom: idx === tradeClaims.length - 1 ? 'none' : `1px solid ${tokens.colors.border}` }}>
                <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 600 }}>{clm.id}</td>
                <td style={{ padding: '12px 16px', fontWeight: 600, color: tokens.colors.textMain }}>{clm.distributor}</td>
                <td style={{ padding: '12px 16px', color: tokens.colors.brand }}>{clm.scheme}</td>
                <td style={{ padding: '12px 16px', fontWeight: 700 }}>{clm.amount}</td>
                <td style={{ padding: '12px 16px' }}><StatusBadge status={clm.status} /></td>
                {canApprove && (
                  <td style={{ padding: '12px 16px' }}>
                    {clm.status === 'PENDING_APPROVAL' ? (
                      <button
                        onClick={() => approveTradeClaim(clm.id)}
                        style={{
                          padding: '4px 10px',
                          backgroundColor: tokens.colors.successBg,
                          color: tokens.colors.success,
                          border: `1px solid ${tokens.colors.successBorder}`,
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: 700,
                        }}
                      >
                        ✓ Authorize Payout
                      </button>
                    ) : (
                      <span style={{ fontSize: '12px', color: tokens.colors.textMuted }}>Settled</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal title="Submit Trade Promotion Claim" subtitle="Distributor claim for scheme discount or volume reward" isOpen={showModal} onClose={() => setShowModal(false)}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <FormField label="Distributor Partner">
            <select value={distributor} onChange={(e) => setDistributor(e.target.value)} style={tokens.presets.input}>
              {DISTRIBUTOR_NAMES.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Target Promotion Scheme">
            <select value={scheme} onChange={(e) => setScheme(e.target.value)} style={tokens.presets.input}>
              {tradeSchemes.map((s) => (
                <option key={s.id} value={s.name}>{s.name} ({s.reward})</option>
              ))}
            </select>
          </FormField>

          <FormField label="Claim Amount ($)">
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={tokens.presets.input}
              required
            />
          </FormField>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
            <button type="button" onClick={() => setShowModal(false)} style={tokens.presets.buttonSecondary}>Cancel</button>
            <button type="submit" style={tokens.presets.buttonPrimary}>Submit Claim</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
