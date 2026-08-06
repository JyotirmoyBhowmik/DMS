import React from 'react';
import { UserRole, VanSale } from '../../types';
import { useData } from '../../context/DataContext';
import { StatusBadge } from '../../components/StatusBadge';
import { tokens } from '../../theme/tokens';

export const VanSales: React.FC<{ role: UserRole }> = ({ role: _role }) => {
  const { vanSales } = useData();

  const totalDispatched = vanSales.filter((v: VanSale) => v.status === 'DISPATCHED').length;
  const totalDelivered = vanSales.filter((v: VanSale) => v.status === 'DELIVERED').length;
  const totalLoading = vanSales.filter((v: VanSale) => v.status === 'LOADING').length;

  return (
    <div style={{ padding: '24px', backgroundColor: tokens.colors.bgApp, minHeight: '100vh', color: tokens.colors.textBody }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: tokens.colors.textMain, margin: 0 }}>Van Sales & Deliveries</h1>
          <p style={{ color: tokens.colors.textMuted, margin: '4px 0 0', fontSize: '14px' }}>
            Mobile distribution van tracking, stock load & spot invoicing
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Dispatched Vans', value: totalDispatched, color: tokens.colors.info },
          { label: 'Delivered Outlets', value: totalDelivered, color: tokens.colors.success },
          { label: 'Loading at Hub', value: totalLoading, color: tokens.colors.warning },
        ].map(stat => (
          <div key={stat.label} style={{ backgroundColor: '#FFFFFF', padding: '16px', borderRadius: '8px', border: `1px solid ${tokens.colors.border}` }}>
            <div style={{ color: tokens.colors.textMuted, fontSize: '14px', marginBottom: '8px' }}>{stat.label}</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: stat.color }}>{stat.value}</div>
          </div>
        ))}
      </div>

      <div style={{ backgroundColor: '#FFFFFF', border: `1px solid ${tokens.colors.border}`, borderRadius: '8px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ backgroundColor: '#F8FAFC', borderBottom: `1px solid ${tokens.colors.border}` }}>
            <tr>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: tokens.colors.textBody, fontSize: '13px' }}>Van ID</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: tokens.colors.textBody, fontSize: '13px' }}>Order Value</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: tokens.colors.textBody, fontSize: '13px' }}>Items Count</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: tokens.colors.textBody, fontSize: '13px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {vanSales.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: tokens.colors.textMuted, fontSize: '14px' }}>
                  No van sales transactions recorded in database
                </td>
              </tr>
            ) : (
              vanSales.map((v: VanSale, idx: number) => (
                <tr key={v.id} style={{ borderBottom: idx === vanSales.length - 1 ? 'none' : `1px solid ${tokens.colors.border}` }}>
                  <td style={{ padding: '12px 16px', fontWeight: '600', fontFamily: 'monospace' }}>{v.vanId}</td>
                  <td style={{ padding: '12px 16px', fontWeight: '700', color: tokens.colors.textMain }}>{v.orderValue.startsWith('$') ? v.orderValue : `$${v.orderValue}`}</td>
                  <td style={{ padding: '12px 16px', color: tokens.colors.textMuted }}>{v.itemsCount} SKUs</td>
                  <td style={{ padding: '12px 16px' }}><StatusBadge status={v.status} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
