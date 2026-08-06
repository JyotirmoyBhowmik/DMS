import React from 'react';
import { UserRole, SkuItem } from '../../types';
import { useData } from '../../context/DataContext';
import { tokens } from '../../theme/tokens';

export const StockLedger: React.FC<{ role: UserRole }> = ({ role }) => {
  const { inventory } = useData();

  const totalSkus = inventory.length;
  const totalUnits = inventory.reduce((acc: number, item: SkuItem) => acc + item.stock, 0);
  const lowStockCount = inventory.filter((item: SkuItem) => item.stock <= item.minThreshold).length;
  const totalValue = inventory.reduce((acc: number, item: SkuItem) => acc + (item.stock * item.price), 0);

  const byCategory = inventory.reduce((acc: Record<string, SkuItem[]>, item: SkuItem) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, SkuItem[]>);

  return (
    <div style={{ padding: '24px', backgroundColor: tokens.colors.bgApp, minHeight: '100vh', color: tokens.colors.textBody }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: tokens.colors.textMain, marginBottom: '24px' }}>Stock & Warehouse Ledger</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Total SKUs', value: totalSkus, color: tokens.colors.textMain },
          { label: 'Total Units', value: totalUnits.toLocaleString(), color: tokens.colors.textMain },
          { label: 'Low Stock Alerts', value: lowStockCount, color: tokens.colors.danger },
          { label: 'Total Stock Value', value: `$${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, color: tokens.colors.success },
        ].map(stat => (
          <div key={stat.label} style={{ backgroundColor: '#FFFFFF', padding: '16px', borderRadius: '8px', border: `1px solid ${tokens.colors.border}` }}>
            <div style={{ color: tokens.colors.textMuted, fontSize: '14px', marginBottom: '8px' }}>{stat.label}</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: stat.color }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {inventory.length === 0 ? (
        <div style={{ backgroundColor: '#FFFFFF', border: `1px solid ${tokens.colors.border}`, borderRadius: '8px', padding: '24px' }}>
          <p style={{ color: tokens.colors.textMuted, fontSize: '14px', margin: 0 }}>No stock ledger items found in database catalog.</p>
        </div>
      ) : (
        <div style={{ backgroundColor: '#FFFFFF', border: `1px solid ${tokens.colors.border}`, borderRadius: '8px', padding: '24px' }}>
          {Object.entries(byCategory).map(([category, items]: [string, SkuItem[]]) => (
            <div key={category} style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '18px', color: tokens.colors.textMain, margin: '0 0 12px 0', paddingBottom: '8px', borderBottom: `1px solid ${tokens.colors.border}` }}>{category}</h2>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '8px', color: tokens.colors.textMuted, fontSize: '13px', fontWeight: 600 }}>SKU</th>
                    <th style={{ textAlign: 'left', padding: '8px', color: tokens.colors.textMuted, fontSize: '13px', fontWeight: 600 }}>Name</th>
                    <th style={{ textAlign: 'right', padding: '8px', color: tokens.colors.textMuted, fontSize: '13px', fontWeight: 600 }}>Stock</th>
                    <th style={{ textAlign: 'right', padding: '8px', color: tokens.colors.textMuted, fontSize: '13px', fontWeight: 600 }}>Unit Price</th>
                    <th style={{ textAlign: 'right', padding: '8px', color: tokens.colors.textMuted, fontSize: '13px', fontWeight: 600 }}>Value</th>
                    <th style={{ textAlign: 'center', padding: '8px', color: tokens.colors.textMuted, fontSize: '13px', fontWeight: 600 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item: SkuItem) => {
                    const isLow = item.stock <= item.minThreshold;
                    return (
                      <tr key={item.sku}>
                        <td style={{ padding: '8px', borderBottom: `1px solid ${tokens.colors.border}`, fontFamily: 'monospace', fontWeight: 600 }}>{item.sku}</td>
                        <td style={{ padding: '8px', borderBottom: `1px solid ${tokens.colors.border}` }}>{item.name}</td>
                        <td style={{ padding: '8px', textAlign: 'right', borderBottom: `1px solid ${tokens.colors.border}`, fontWeight: 700, color: isLow ? tokens.colors.danger : tokens.colors.textMain }}>{item.stock}</td>
                        <td style={{ padding: '8px', textAlign: 'right', borderBottom: `1px solid ${tokens.colors.border}` }}>${item.price.toFixed(2)}</td>
                        <td style={{ padding: '8px', textAlign: 'right', borderBottom: `1px solid ${tokens.colors.border}`, fontWeight: 600 }}>${(item.stock * item.price).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        <td style={{ padding: '8px', textAlign: 'center', borderBottom: `1px solid ${tokens.colors.border}` }}>
                          <span style={{
                            fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '4px',
                            backgroundColor: isLow ? tokens.colors.dangerBg : tokens.colors.successBg,
                            color: isLow ? tokens.colors.danger : tokens.colors.success,
                          }}>
                            {isLow ? 'LOW STOCK' : 'HEALTHY'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
