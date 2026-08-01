import React, { useState } from 'react';
import { UserRole } from '../../types';
import { SEED_TRADE_SCHEMES } from '../../data/seed';
import { StatusBadge } from '../../components/StatusBadge';

export const PricingSchemes: React.FC<{ role: UserRole }> = ({ role }) => {
  const [showForm, setShowForm] = useState(false);

  return (
    <div style={{ padding: '24px', backgroundColor: '#F8FAFC', minHeight: '100vh', color: '#334155', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ margin: 0, color: '#0F172A', fontSize: '24px', fontWeight: 'bold' }}>Pricing Schemes</h1>
        {role === 'admin' && (
          <button 
            onClick={() => setShowForm(!showForm)}
            style={{ padding: '8px 16px', backgroundColor: '#2563EB', color: '#FFFFFF', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 500 }}
          >
            {showForm ? 'Cancel' : '+ Create Scheme'}
          </button>
        )}
      </div>

      {showForm && role === 'admin' && (
        <div style={{ backgroundColor: '#FFFFFF', padding: '24px', borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: '24px' }}>
          <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#0F172A' }}>Create Pricing Scheme</h2>
          <form style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Scheme Name</label>
              <input type="text" style={{ width: '100%', padding: '8px', border: '1px solid #E2E8F0', borderRadius: '4px' }} />
            </div>
            <div style={{ flex: '1 1 150px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Min Qty</label>
              <input type="number" style={{ width: '100%', padding: '8px', border: '1px solid #E2E8F0', borderRadius: '4px' }} />
            </div>
             <div style={{ flex: '1 1 150px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Validity</label>
              <input type="date" style={{ width: '100%', padding: '8px', border: '1px solid #E2E8F0', borderRadius: '4px' }} />
            </div>
            <button type="button" onClick={() => setShowForm(false)} style={{ padding: '8px 24px', backgroundColor: '#15803D', color: '#FFFFFF', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 500, height: '35px' }}>
              Save
            </button>
          </form>
        </div>
      )}

      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              <th style={{ padding: '12px 16px', fontWeight: 500, color: '#64748B' }}>Scheme Name</th>
              <th style={{ padding: '12px 16px', fontWeight: 500, color: '#64748B' }}>Type</th>
              <th style={{ padding: '12px 16px', fontWeight: 500, color: '#64748B' }}>Min Qty Required</th>
              <th style={{ padding: '12px 16px', fontWeight: 500, color: '#64748B' }}>Promotional Reward</th>
              <th style={{ padding: '12px 16px', fontWeight: 500, color: '#64748B' }}>Validity</th>
            </tr>
          </thead>
          <tbody>
            {SEED_TRADE_SCHEMES.map((scheme, idx) => (
              <tr key={scheme.id} style={{ borderBottom: idx === SEED_TRADE_SCHEMES.length - 1 ? 'none' : '1px solid #E2E8F0' }}>
                <td style={{ padding: '12px 16px', fontWeight: 500 }}>{scheme.name}</td>
                <td style={{ padding: '12px 16px' }}>
                  <StatusBadge status={scheme.type} />
                </td>
                <td style={{ padding: '12px 16px' }}>{scheme.minQty}</td>
                <td style={{ padding: '12px 16px' }}>{scheme.reward}</td>
                <td style={{ padding: '12px 16px' }}>{scheme.validUntil}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
