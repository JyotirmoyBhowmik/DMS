import React, { useState } from 'react';
import type { UserRole } from '../../types';
import { useData } from '../../context/DataContext';
import { StatusBadge } from '../../components/StatusBadge';
import { OutletCreateModal } from '../../components/forms/OutletCreateModal';

export const OutletRegistry: React.FC<{ role: UserRole }> = ({ role }) => {
  const { outlets, addOutlet } = useData();
  const [showModal, setShowModal] = useState(false);

  const canAdd = role === 'admin';

  return (
    <div style={{ padding: '24px', backgroundColor: '#F8FAFC', minHeight: '100vh', color: '#334155' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#0F172A', margin: 0 }}>Retailer & Credit Limits</h1>
          <p style={{ color: '#64748B', margin: '4px 0 0', fontSize: '14px' }}>
            Outlet master registry, territory mapping & credit line authorizations
          </p>
        </div>

        {canAdd && (
          <button
            onClick={() => setShowModal(true)}
            style={{
              padding: '10px 18px',
              backgroundColor: '#0F172A',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px',
            }}
          >
            + Register Retail Outlet
          </button>
        )}
      </div>

      <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Outlet Name</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Store Type</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Address / Territory</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Credit Limit</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Assigned Rep</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {outlets.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#64748B', fontSize: '14px' }}>
                  No registered outlets found in database
                </td>
              </tr>
            ) : (
              outlets.map((out, idx) => (
                <tr key={out.id} style={{ borderBottom: idx === outlets.length - 1 ? 'none' : '1px solid #E2E8F0' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0F172A' }}>{out.name}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ backgroundColor: '#F1F5F9', color: '#475569', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                      {out.type}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#64748B' }}>{out.address}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: '#15803D' }}>${out.creditLimit.toLocaleString()}</td>
                  <td style={{ padding: '12px 16px', color: '#64748B' }}>{out.assignedAgent}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <StatusBadge status={out.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <OutletCreateModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={(o) => addOutlet(o)}
      />
    </div>
  );
};
