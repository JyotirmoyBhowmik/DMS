import React, { useState, useEffect } from 'react';
import { UserRole, VanSale } from '../../types';
import { dbService } from '../../services/dbService';
import { StatusBadge } from '../../components/StatusBadge';

export const VanSales: React.FC<{ role: UserRole }> = ({ role }) => {
  const [vanSales, setVanSales] = useState<VanSale[]>([]);

  useEffect(() => {
    dbService.getVanSales().then(setVanSales);
  }, []);

  const totalDispatched = vanSales.filter((v: VanSale) => v.status === 'DISPATCHED').length;
  const totalDelivered = vanSales.filter((v: VanSale) => v.status === 'DELIVERED').length;
  const totalLoading = vanSales.filter((v: VanSale) => v.status === 'LOADING').length;

  return (
    <div style={{ padding: '24px', backgroundColor: '#F8FAFC', minHeight: '100vh', color: '#334155' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#0F172A', marginBottom: '24px' }}>Van Sales & Deliveries</h1>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Total Dispatched', value: totalDispatched },
          { label: 'Total Delivered', value: totalDelivered, color: '#15803D' },
          { label: 'Total Loading', value: totalLoading, color: '#B45309' }
        ].map(stat => (
          <div key={stat.label} style={{ backgroundColor: '#FFFFFF', padding: '16px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <div style={{ color: '#64748B', fontSize: '14px', marginBottom: '8px' }}>{stat.label}</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: stat.color || '#0F172A' }}>{stat.value}</div>
          </div>
        ))}
      </div>

      <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
            <tr>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Van ID</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Order Value</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Items Count</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {vanSales.map((v: VanSale) => (
              <tr key={v.id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                <td style={{ padding: '12px 16px', fontWeight: '500' }}>{v.vanId}</td>
                <td style={{ padding: '12px 16px' }}>{v.orderValue.startsWith('$') ? v.orderValue : `$${v.orderValue}`}</td>
                <td style={{ padding: '12px 16px' }}>{v.itemsCount}</td>
                <td style={{ padding: '12px 16px' }}><StatusBadge status={v.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
