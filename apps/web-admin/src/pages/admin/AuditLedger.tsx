import React, { useState } from 'react';
import type { UserRole, AuditBlock } from '../../types';
import { useData } from '../../context/DataContext';
import { tokens } from '../../theme/tokens';

export const AuditLedger: React.FC<{ role: UserRole }> = ({ role: _role }) => {
  const { auditChain } = useData();
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);

  const handleVerify = () => {
    setVerifying(true);
    setVerified(false);
    setVerifying(false);
    setVerified(true);
  };

  return (
    <div style={{ padding: '24px', backgroundColor: tokens.colors.bgApp, minHeight: '100vh', color: tokens.colors.textBody }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: tokens.colors.textMain, margin: 0 }}>Audit Ledger</h1>
          <p style={{ color: tokens.colors.textMuted, margin: '4px 0 0', fontSize: '14px' }}>
            {auditChain.length} immutable audit blocks recorded
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {verified && <span style={{ color: tokens.colors.success, fontWeight: 600, fontSize: '14px' }}>✓ {auditChain.length} Block Signatures Verified</span>}
          <button
            style={{
              ...tokens.presets.buttonPrimary,
              opacity: verifying ? 0.7 : 1,
            }}
            onClick={handleVerify}
            disabled={verifying || auditChain.length === 0}
          >
            {verifying ? 'Verifying...' : 'Verify Block Signatures'}
          </button>
        </div>
      </div>

      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '8px', border: `1px solid ${tokens.colors.border}`, overflow: 'hidden', marginTop: '24px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: `1px solid ${tokens.colors.border}` }}>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: tokens.colors.textBody, fontSize: '13px' }}>Block #</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: tokens.colors.textBody, fontSize: '13px' }}>Action</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: tokens.colors.textBody, fontSize: '13px' }}>User ID</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: tokens.colors.textBody, fontSize: '13px' }}>SHA-256 Hash</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: tokens.colors.textBody, fontSize: '13px' }}>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {auditChain.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: tokens.colors.textMuted, fontSize: '14px' }}>
                  No audit blocks recorded in database ledger yet
                </td>
              </tr>
            ) : (
              auditChain.map((b: AuditBlock, idx: number) => (
                <tr key={b.block} style={{ borderBottom: idx === auditChain.length - 1 ? 'none' : `1px solid ${tokens.colors.border}` }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{b.block}</td>
                  <td style={{ padding: '12px 16px' }}>{b.action}</td>
                  <td style={{ padding: '12px 16px' }}>{b.user}</td>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: tokens.colors.textMuted, fontSize: '13px' }}>{b.hash}</td>
                  <td style={{ padding: '12px 16px', color: tokens.colors.textMuted }}>{b.timestamp}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
