import React, { useState, useEffect } from 'react';
import { UserRole, SkuItem } from '../../types';
import { SKU_CATEGORIES, DISTRIBUTOR_NAMES } from '../../data/seed';
import { dbService } from '../../services/dbService';

export const SkuCatalog: React.FC<{ role: UserRole }> = ({ role }) => {
  const [inventory, setInventory] = useState<SkuItem[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    dbService.getInventory().then(setInventory);
  }, []);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setIsModalOpen(false);
  };

  const filtered = inventory.filter((item: SkuItem) => 
    item.name.toLowerCase().includes(search.toLowerCase()) || 
    item.sku.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: '24px', backgroundColor: '#F8FAFC', minHeight: '100vh', color: '#334155' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#0F172A', margin: 0 }}>SKU Catalog</h1>
        <div style={{ display: 'flex', gap: '16px' }}>
          <input 
            type="text" 
            placeholder="Search SKU/Name..." 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            style={{ padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: '4px' }}
          />
          {(role === 'admin' || role === 'distributor') && (
            <button 
              onClick={() => setIsModalOpen(true)}
              style={{ padding: '8px 16px', backgroundColor: '#2563EB', color: '#FFFFFF', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              + Add New SKU
            </button>
          )}
        </div>
      </div>

      <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
            <tr>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>SKU Code</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Product Description</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Category</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Distributor</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Stock Qty</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Unit Price</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Stock Alert</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item: SkuItem) => (
              <tr key={item.sku} style={{ borderBottom: '1px solid #E2E8F0' }}>
                <td style={{ padding: '12px 16px' }}>{item.sku}</td>
                <td style={{ padding: '12px 16px' }}>{item.name}</td>
                <td style={{ padding: '12px 16px' }}>{item.category}</td>
                <td style={{ padding: '12px 16px' }}>{item.distributor}</td>
                <td style={{ padding: '12px 16px' }}>{item.stock}</td>
                <td style={{ padding: '12px 16px' }}>${item.price}</td>
                <td style={{ padding: '12px 16px', color: item.stock <= item.minThreshold ? '#B91C1C' : '#15803D', fontWeight: 'bold' }}>
                  {item.stock <= item.minThreshold ? 'LOW STOCK' : 'OPTIMAL'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ backgroundColor: '#FFFFFF', padding: '24px', borderRadius: '8px', width: '400px' }}>
            <h2 style={{ margin: '0 0 16px 0', color: '#0F172A' }}>Add New SKU</h2>
            <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input type="text" placeholder="Product Name" required style={{ padding: '8px', border: '1px solid #E2E8F0', borderRadius: '4px' }} />
              <select style={{ padding: '8px', border: '1px solid #E2E8F0', borderRadius: '4px' }}>
                {SKU_CATEGORIES?.map((c: string) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select style={{ padding: '8px', border: '1px solid #E2E8F0', borderRadius: '4px' }}>
                {DISTRIBUTOR_NAMES?.map((d: string) => <option key={d} value={d}>{d}</option>)}
              </select>
              <input type="number" placeholder="Price" required style={{ padding: '8px', border: '1px solid #E2E8F0', borderRadius: '4px' }} />
              <input type="number" placeholder="Initial Stock" required style={{ padding: '8px', border: '1px solid #E2E8F0', borderRadius: '4px' }} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '8px 16px', border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '8px 16px', backgroundColor: '#2563EB', color: '#FFFFFF', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
