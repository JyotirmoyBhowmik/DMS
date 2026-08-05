import React from 'react';
import { UserRole } from '../../types';

export const Reports: React.FC<{ role: UserRole }> = () => {
  return (
    <div style={{ padding: '24px', backgroundColor: '#F8FAFC', minHeight: '100vh', color: '#334155', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ margin: 0, color: '#0F172A', fontSize: '24px', fontWeight: 'bold' }}>Analytics & Reports</h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={() => alert('Exporting as CSV...')}
            style={{ padding: '8px 16px', backgroundColor: '#FFFFFF', color: '#334155', border: '1px solid #E2E8F0', borderRadius: '4px', cursor: 'pointer', fontWeight: 500 }}
          >
            Export CSV
          </button>
          <button 
            onClick={() => alert('Exporting as PDF...')}
            style={{ padding: '8px 16px', backgroundColor: '#FFFFFF', color: '#334155', border: '1px solid #E2E8F0', borderRadius: '4px', cursor: 'pointer', fontWeight: 500 }}
          >
            Export PDF
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        <div style={{ backgroundColor: '#FFFFFF', padding: '20px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: '14px', color: '#64748B', marginBottom: '8px' }}>Total Revenue</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#0F172A' }}>$142,520</div>
        </div>
        <div style={{ backgroundColor: '#FFFFFF', padding: '20px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: '14px', color: '#64748B', marginBottom: '8px' }}>Total Orders</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#0F172A' }}>5</div>
        </div>
        <div style={{ backgroundColor: '#FFFFFF', padding: '20px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: '14px', color: '#64748B', marginBottom: '8px' }}>Avg Order Value</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#0F172A' }}>$28,504</div>
        </div>
        <div style={{ backgroundColor: '#FFFFFF', padding: '20px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: '14px', color: '#64748B', marginBottom: '8px' }}>Active Outlets</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#0F172A' }}>4</div>
        </div>
      </div>

      <div style={{ backgroundColor: '#FFFFFF', padding: '24px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
        <h2 style={{ margin: '0 0 20px 0', fontSize: '16px', color: '#0F172A' }}>Sales by Distributor</h2>
        <div style={{ height: '300px', display: 'flex', alignItems: 'flex-end', gap: '40px', padding: '20px 0', borderBottom: '1px solid #E2E8F0' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '60px', height: '100%', backgroundColor: '#2563EB', borderRadius: '4px 4px 0 0', position: 'relative' }}></div>
            <span style={{ fontSize: '12px', color: '#64748B' }}>Alpha Dist.</span>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '60px', height: '65%', backgroundColor: '#2563EB', borderRadius: '4px 4px 0 0', position: 'relative' }}></div>
            <span style={{ fontSize: '12px', color: '#64748B' }}>Beta Logistics</span>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '60px', height: '80%', backgroundColor: '#2563EB', borderRadius: '4px 4px 0 0', position: 'relative' }}></div>
            <span style={{ fontSize: '12px', color: '#64748B' }}>Gamma Supplies</span>
          </div>
        </div>
      </div>
    </div>
  );
};
