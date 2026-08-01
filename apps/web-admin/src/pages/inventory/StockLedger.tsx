import React, { useState, useEffect } from 'react';
import { UserRole, SkuItem } from '../../types';
import { dbService } from '../../services/dbService';

export const StockLedger: React.FC<{ role: UserRole }> = ({ role }) => {
  const [inventory, setInventory] = useState<SkuItem[]>([]);

  useEffect(() => {
    dbService.getInventory().then(setInventory);
  }, []);

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
    <div style={{ padding: '24px', backgroundColor: '#F8FAFC', minHeight: '100vh', color: '#334155' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#0F172A', marginBottom: '24px' }}>Stock Ledger</h1>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Total SKUs', value: totalSkus },
          { label: 'Total Units', value: totalUnits },
          { label: 'Low Stock Items', value: lowStockCount, color: '#B91C1C' },
          { label: 'Total Value', value: `$${totalValue.toFixed(2)}` }
        ].map(stat => (
          <div key={stat.label} style={{ backgroundColor: '#FFFFFF', padding: '16px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <div style={{ color: '#64748B', fontSize: '14px', marginBottom: '8px' }}>{stat.label}</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: stat.color || '#0F172A' }}>{stat.value}</div>
          </div>
        ))}
      </div>

      <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '24px' }}>
        {Object.entries(byCategory).map(([category, items]: [string, SkuItem[]]) => (
          <div key={category} style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '18px', color: '#0F172A', margin: '0 0 12px 0', paddingBottom: '8px', borderBottom: '1px solid #E2E8F0' }}>{category}</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '8px', color: '#64748B' }}>SKU</th>
                  <th style={{ textAlign: 'left', padding: '8px', color: '#64748B' }}>Name</th>
                  <th style={{ textAlign: 'right', padding: '8px', color: '#64748B' }}>Stock</th>
                  <th style={{ textAlign: 'right', padding: '8px', color: '#64748B' }}>Value</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: SkuItem) => (
                  <tr key={item.sku}>
                    <td style={{ padding: '8px', borderBottom: '1px solid #E2E8F0' }}>{item.sku}</td>
                    <td style={{ padding: '8px', borderBottom: '1px solid #E2E8F0' }}>{item.name}</td>
                    <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid #E2E8F0' }}>{item.stock}</td>
                    <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid #E2E8F0' }}>${(item.stock * item.price).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        {role === 'admin' && (
           <div style={{ marginTop: '24px', padding: '16px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
             <h3 style={{ margin: '0 0 12px 0' }}>Adjust Stock</h3>
             <div style={{ display: 'flex', gap: '8px' }}>
                <input type="text" placeholder="SKU Code" style={{ padding: '8px', border: '1px solid #E2E8F0', borderRadius: '4px' }} />
                <input type="number" placeholder="Qty" style={{ padding: '8px', border: '1px solid #E2E8F0', borderRadius: '4px' }} />
                <button style={{ padding: '8px 16px', backgroundColor: '#2563EB', color: '#FFFFFF', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Update</button>
             </div>
           </div>
        )}
      </div>
    </div>
  );
};
