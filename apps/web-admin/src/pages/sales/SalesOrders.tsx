import React, { useState } from 'react';
import type { UserRole } from '../../types';
import { useData } from '../../context/DataContext';
import { StatusBadge } from '../../components/StatusBadge';
import { OrderCreateModal } from '../../components/forms/OrderCreateModal';

export const SalesOrders: React.FC<{ role: UserRole }> = ({ role }) => {
  const { salesOrders, addSalesOrder, approveSalesOrder, rejectSalesOrder } = useData();
  const [showModal, setShowModal] = useState(false);

  const canApprove = role === 'admin';
  const canCreate = role === 'agent' || role === 'admin';

  return (
    <div style={{ padding: '24px', backgroundColor: '#F8FAFC', minHeight: '100vh', color: '#334155' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#0F172A', margin: 0 }}>Sales Orders</h1>
          <p style={{ color: '#64748B', margin: '4px 0 0', fontSize: '14px' }}>
            Field order collection & distributor fulfillment approvals
          </p>
        </div>

        {canCreate && (
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
            + Create New Field Order
          </button>
        )}
      </div>

      <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Order ID</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Retail Outlet</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Field Agent</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Order Amount</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Items</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Status</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Date</th>
              {canApprove && <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {salesOrders.length === 0 ? (
              <tr>
                <td colSpan={canApprove ? 8 : 7} style={{ padding: '24px', textAlign: 'center', color: '#64748B', fontSize: '14px' }}>
                  No field sales orders found in database
                </td>
              </tr>
            ) : (
              salesOrders.map((ord, idx) => (
                <tr key={ord.id} style={{ borderBottom: idx === salesOrders.length - 1 ? 'none' : '1px solid #E2E8F0' }}>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 600 }}>{ord.id}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0F172A' }}>{ord.outlet}</td>
                  <td style={{ padding: '12px 16px', color: '#64748B' }}>{ord.agent}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 700 }}>{ord.totalAmount}</td>
                  <td style={{ padding: '12px 16px' }}>{ord.items} units</td>
                  <td style={{ padding: '12px 16px' }}>
                    <StatusBadge status={ord.status} />
                  </td>
                  <td style={{ padding: '12px 16px', color: '#64748B', fontSize: '12px' }}>{ord.date}</td>
                  {canApprove && (
                    <td style={{ padding: '12px 16px' }}>
                      {ord.status === 'PENDING_APPROVAL' ? (
                        <button
                          onClick={() => approveSalesOrder(ord.id)}
                          style={{
                            padding: '4px 10px',
                            backgroundColor: '#DCFCE7',
                            color: '#15803D',
                            border: '1px solid #86EFAC',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 700,
                          }}
                        >
                          ✓ Approve
                        </button>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#94A3B8' }}>Approved</span>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <OrderCreateModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={(ord) => addSalesOrder(ord)}
      />
    </div>
  );
};
