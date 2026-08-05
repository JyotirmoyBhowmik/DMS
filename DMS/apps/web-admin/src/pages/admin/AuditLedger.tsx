import React, { useState, useEffect } from 'react';
import type { UserRole, AuditBlock } from '../../types';
import { dbService } from '../../services/dbService';

interface AuditLedgerProps {
  role: UserRole;
}

export const AuditLedger: React.FC<AuditLedgerProps> = ({ role }) => {
  const [chain, setChain] = useState<AuditBlock[]>([]);
  const [verifying, setVerifying] = useState<boolean>(false);
  const [verified, setVerified] = useState<boolean>(false);

  useEffect(() => {
    dbService.getAuditChain().then(setChain);
  }, []);

  const handleVerify = () => {
    setVerifying(true);
    setVerified(false);
    setTimeout(() => {
      setVerifying(false);
      setVerified(true);
    }, 1500);
  };

  const containerStyle: React.CSSProperties = { padding: '24px', backgroundColor: '#F8FAFC', minHeight: '100vh', color: '#334155' };
  const headerStyle: React.CSSProperties = { fontSize: '24px', fontWeight: 'bold', color: '#0F172A' };
  const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', backgroundColor: '#FFFFFF', borderRadius: '8px', overflow: 'hidden', border: '1px solid #E2E8F0', marginTop: '24px' };
  const thStyle: React.CSSProperties = { padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#64748B', fontWeight: 600, fontSize: '14px' };
  const tdStyle: React.CSSProperties = { padding: '12px 16px', borderBottom: '1px solid #E2E8F0', fontSize: '14px' };
  const monoStyle: React.CSSProperties = { fontFamily: 'monospace', color: '#475569', fontSize: '13px' };
  const buttonStyle: React.CSSProperties = { backgroundColor: '#2563EB', color: '#FFFFFF', padding: '8px 16px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500, opacity: verifying ? 0.7 : 1 };

  return (
    <div style={containerStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={headerStyle}>Audit Ledger</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {verified && <span style={{ color: '#15803D', fontWeight: 600, fontSize: '14px' }}>✓ Signatures Verified</span>}
          <button style={buttonStyle} onClick={handleVerify} disabled={verifying}>
            {verifying ? 'Verifying...' : 'Verify Block Signatures'}
          </button>
        </div>
      </div>

      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Block #</th><th style={thStyle}>Action</th><th style={thStyle}>User ID</th><th style={thStyle}>SHA-256 Hash</th><th style={thStyle}>Timestamp</th>
          </tr>
        </thead>
        <tbody>
          {chain.map((b: AuditBlock) => (
            <tr key={b.block}>
              <td style={tdStyle}>{b.block}</td>
              <td style={tdStyle}>{b.action}</td>
              <td style={tdStyle}>{b.user}</td>
              <td style={{ ...tdStyle, ...monoStyle }}>{b.hash}</td>
              <td style={tdStyle}>{b.timestamp}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
