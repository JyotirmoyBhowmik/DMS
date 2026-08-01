import React, { useState } from 'react';
import { UserRole, TradeClaim } from '../../types';
import { SEED_TRADE_CLAIMS } from '../../data/seed';
import { StatusBadge } from '../../components/StatusBadge';

export const TradeClaims: React.FC<{ role: UserRole }> = ({ role }) => {
  const [claims, setClaims] = useState<TradeClaim[]>(SEED_TRADE_CLAIMS);
  const [showForm, setShowForm] = useState(false);

  const handleApprove = (id: string) => {
    setClaims(claims.map(c => c.id === id ? { ...c, status: 'SETTLED' } : c));
  };

  const handleReject = (id: string) => {
    setClaims(claims.map(c => c.id === id ? { ...c, status: 'REJECTED' } : c));
  };

  // Only distributors see their own, but since we don't have auth context, 
  // we'll just show all if admin, or pretend they're the distributor of all for demo.
  const displayClaims = role === 'distributor' ? claims.slice(0, 2) : claims;

  return (
    <div style={{ padding: '24px', backgroundColor: '#F8FAFC', minHeight: '100vh', color: '#334155', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ margin: 0, color: '#0F172A', fontSize: '24px', fontWeight: 'bold' }}>Trade Claims</h1>
        {role === 'distributor' && (
          <button 
            onClick={() => setShowForm(!showForm)}
            style={{ padding: '8px 16px', backgroundColor: '#2563EB', color: '#FFFFFF', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 500 }}
          >
            {showForm ? 'Cancel' : '+ Submit Claim'}
          </button>
        )}
      </div>

      {showForm && role === 'distributor' && (
        <div style={{ backgroundColor: '#FFFFFF', padding: '24px', borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: '24px' }}>
          <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#0F172A' }}>Submit New Claim</h2>
          <form style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
             <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Promotion Scheme</label>
              <input type="text" placeholder="Scheme Name" style={{ width: '100%', padding: '8px', border: '1px solid #E2E8F0', borderRadius: '4px' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Claim Amount ($)</label>
              <input type="number" style={{ width: '100%', padding: '8px', border: '1px solid #E2E8F0', borderRadius: '4px' }} />
            </div>
            <button type="button" onClick={() => setShowForm(false)} style={{ padding: '8px 24px', backgroundColor: '#15803D', color: '#FFFFFF', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 500, height: '35px' }}>
              Submit
            </button>
          </form>
        </div>
      )}

      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              <th style={{ padding: '12px 16px', fontWeight: 500, color: '#64748B' }}>Claim ID</th>
              <th style={{ padding: '12px 16px', fontWeight: 500, color: '#64748B' }}>Distributor</th>
              <th style={{ padding: '12px 16px', fontWeight: 500, color: '#64748B' }}>Promotion Scheme</th>
              <th style={{ padding: '12px 16px', fontWeight: 500, color: '#64748B' }}>Claim Amount</th>
              <th style={{ padding: '12px 16px', fontWeight: 500, color: '#64748B' }}>Status</th>
              {role === 'admin' && <th style={{ padding: '12px 16px', fontWeight: 500, color: '#64748B' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {displayClaims.map((claim, idx) => (
              <tr key={claim.id} style={{ borderBottom: idx === displayClaims.length - 1 ? 'none' : '1px solid #E2E8F0' }}>
                <td style={{ padding: '12px 16px', fontWeight: 500 }}>{claim.id}</td>
                <td style={{ padding: '12px 16px' }}>{claim.distributor}</td>
                <td style={{ padding: '12px 16px' }}>{claim.scheme}</td>
                <td style={{ padding: '12px 16px' }}>{claim.amount}</td>
                <td style={{ padding: '12px 16px' }}>
                  <StatusBadge status={claim.status} />
                </td>
                {role === 'admin' && (
                  <td style={{ padding: '12px 16px' }}>
                    {claim.status === 'PENDING_APPROVAL' && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => handleApprove(claim.id)} style={{ padding: '4px 8px', backgroundColor: '#15803D', color: '#FFFFFF', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Approve</button>
                        <button onClick={() => handleReject(claim.id)} style={{ padding: '4px 8px', backgroundColor: '#B91C1C', color: '#FFFFFF', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Reject</button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
