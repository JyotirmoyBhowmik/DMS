import React, { useMemo } from 'react';
import { UserRole } from '../../types';
import { useData } from '../../context/DataContext';
import { tokens } from '../../theme/tokens';

export const Reports: React.FC<{ role: UserRole }> = () => {
  const { invoices, salesOrders, outlets, inventory } = useData();

  // ── Compute Executive Analytics Metrics ──
  const totalRevenue = useMemo(() => {
    return invoices.reduce((sum, inv) => {
      const num = parseFloat(inv.amount.replace(/[^0-9.]/g, '')) || 0;
      return sum + num;
    }, 0);
  }, [invoices]);

  const totalOrdersCount = salesOrders.length;

  const avgOrderValue = useMemo(() => {
    if (totalOrdersCount === 0) return 0;
    return totalRevenue / totalOrdersCount;
  }, [totalRevenue, totalOrdersCount]);

  const activeOutletsCount = useMemo(() => {
    return outlets.filter(o => o.status === 'ACTIVE').length;
  }, [outlets]);

  // Compute Sales by Distributor from Inventory & Orders
  const salesByDistributor = useMemo(() => {
    const map: Record<string, number> = {};
    inventory.forEach(item => {
      const dist = item.distributor || 'General Distribution';
      map[dist] = (map[dist] || 0) + item.stock * item.price;
    });

    const entries = Object.entries(map);
    const maxVal = Math.max(...entries.map(([, v]) => v), 1);

    return entries.map(([name, val]) => ({
      name,
      value: val,
      heightPercent: Math.min(100, Math.max(20, Math.round((val / maxVal) * 100))),
    }));
  }, [inventory]);

  return (
    <div style={{ padding: '24px', backgroundColor: tokens.colors.bgApp, minHeight: '100vh', color: tokens.colors.textBody }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: tokens.colors.textMain, margin: 0 }}>Executive Analytics & Reports</h1>
          <p style={{ color: tokens.colors.textMuted, margin: '4px 0 0', fontSize: '14px' }}>
            Consolidated secondary sales revenue, distributor performance & outlet metrics
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => alert('Exporting secondary sales report as CSV...')}
            style={tokens.presets.buttonSecondary}
          >
            Export CSV
          </button>
          <button
            onClick={() => alert('Exporting executive PDF summary...')}
            style={tokens.presets.buttonPrimary}
          >
            Export PDF
          </button>
        </div>
      </div>

      {/* Top 4 KPI Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        <div style={{ backgroundColor: '#FFFFFF', padding: '20px', borderRadius: '8px', border: `1px solid ${tokens.colors.border}`, boxShadow: tokens.shadows.sm }}>
          <div style={{ fontSize: '13px', color: tokens.colors.textMuted, marginBottom: '6px', fontWeight: 600 }}>Total Billed Revenue</div>
          <div style={{ fontSize: '26px', fontWeight: 'bold', color: tokens.colors.success }}>
            ${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div style={{ backgroundColor: '#FFFFFF', padding: '20px', borderRadius: '8px', border: `1px solid ${tokens.colors.border}`, boxShadow: tokens.shadows.sm }}>
          <div style={{ fontSize: '13px', color: tokens.colors.textMuted, marginBottom: '6px', fontWeight: 600 }}>Field Sales Orders</div>
          <div style={{ fontSize: '26px', fontWeight: 'bold', color: tokens.colors.textMain }}>
            {totalOrdersCount} Orders
          </div>
        </div>
        <div style={{ backgroundColor: '#FFFFFF', padding: '20px', borderRadius: '8px', border: `1px solid ${tokens.colors.border}`, boxShadow: tokens.shadows.sm }}>
          <div style={{ fontSize: '13px', color: tokens.colors.textMuted, marginBottom: '6px', fontWeight: 600 }}>Avg Order Value</div>
          <div style={{ fontSize: '26px', fontWeight: 'bold', color: tokens.colors.brand }}>
            ${avgOrderValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div style={{ backgroundColor: '#FFFFFF', padding: '20px', borderRadius: '8px', border: `1px solid ${tokens.colors.border}`, boxShadow: tokens.shadows.sm }}>
          <div style={{ fontSize: '13px', color: tokens.colors.textMuted, marginBottom: '6px', fontWeight: 600 }}>Active Outlets</div>
          <div style={{ fontSize: '26px', fontWeight: 'bold', color: tokens.colors.info }}>
            {activeOutletsCount} Stores
          </div>
        </div>
      </div>

      {/* Distributor Revenue Distribution Chart */}
      <div style={{ backgroundColor: '#FFFFFF', padding: '24px', borderRadius: '8px', border: `1px solid ${tokens.colors.border}`, boxShadow: tokens.shadows.sm }}>
        <h2 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: 700, color: tokens.colors.textMain }}>
          Stock & Sales Distribution by Primary Stockist
        </h2>
        <div style={{ height: '260px', display: 'flex', alignItems: 'flex-end', gap: '32px', padding: '20px 0', borderBottom: `1px solid ${tokens.colors.border}` }}>
          {salesByDistributor.map(dist => (
            <div key={dist.name} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: tokens.colors.brand }}>
                ${dist.value.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </span>
              <div style={{
                width: '60px',
                height: `${dist.heightPercent}%`,
                backgroundColor: tokens.colors.brand,
                borderRadius: '6px 6px 0 0',
                transition: 'height 0.3s ease',
              }} />
              <span style={{ fontSize: '12px', color: tokens.colors.textMuted, fontWeight: 600, textAlign: 'center' }}>
                {dist.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
