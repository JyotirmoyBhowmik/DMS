import React, { useState, useMemo } from 'react';
import type { UserRole } from '../../types';
import { useData } from '../../context/DataContext';
import { StatusBadge } from '../../components/StatusBadge';
import { SkuCreateModal } from '../../components/forms/SkuCreateModal';

export const SkuCatalog: React.FC<{ role: UserRole }> = ({ role }) => {
  const { inventory, addSku } = useData();
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  // ⚡ Bolt: Memoized inventory filtering to prevent O(N) recalculation on unrelated re-renders (e.g. modal toggle).
  // Also hoisted `search.toLowerCase()` outside the loop, saving ~3x string allocations per item.
  // Expected impact: Eliminates unnecessary CPU cycles and garbage collection overhead during UI updates.
  const filteredInventory = useMemo(() => {
    if (!search) return inventory;
    const searchLower = search.toLowerCase();
    return inventory.filter(
      (item) =>
        item.name.toLowerCase().includes(searchLower) ||
        item.sku.toLowerCase().includes(searchLower) ||
        item.category.toLowerCase().includes(searchLower)
    );
  }, [inventory, search]);

  const canAdd = role === 'admin' || role === 'distributor';

  return (
    <div style={{ padding: '24px', backgroundColor: '#F8FAFC', minHeight: '100vh', color: '#334155' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#0F172A', margin: 0 }}>SKU Master Catalog</h1>
          <p style={{ color: '#64748B', margin: '4px 0 0', fontSize: '14px' }}>
            Managed master inventory records across distributor networks
          </p>
        </div>

        {canAdd && (
          <button
            onClick={() => setShowAddModal(true)}
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
            + Add New SKU
          </button>
        )}
      </div>

      {/* Search Filter */}
      <div style={{ marginBottom: '16px' }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Search by SKU code, product description or category..."
          style={{
            width: '100%',
            maxWidth: '400px',
            padding: '9px 14px',
            borderRadius: '8px',
            border: '1px solid #CBD5E1',
            fontSize: '13px',
            outline: 'none',
          }}
        />
      </div>

      {/* SKU Table */}
      <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>SKU Code</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Product Description</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Category</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Distributor</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Stock Qty</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Unit Price</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569', fontSize: '13px' }}>Stock Alert</th>
            </tr>
          </thead>
          <tbody>
            {filteredInventory.map((item, idx) => {
              const isLowStock = item.stock <= item.minThreshold;
              return (
                <tr key={item.sku} style={{ borderBottom: idx === filteredInventory.length - 1 ? 'none' : '1px solid #E2E8F0' }}>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 600 }}>{item.sku}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0F172A' }}>{item.name}</td>
                  <td style={{ padding: '12px 16px' }}>{item.category}</td>
                  <td style={{ padding: '12px 16px', color: '#64748B' }}>{item.distributor}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 700 }}>{item.stock.toLocaleString()}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>${item.price.toFixed(2)}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <StatusBadge status={isLowStock ? 'LOW_STOCK' : 'OPTIMAL'} variant={isLowStock ? 'danger' : 'success'} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modular Form Modal */}
      <SkuCreateModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={(skuData) => addSku(skuData)}
      />
    </div>
  );
};
