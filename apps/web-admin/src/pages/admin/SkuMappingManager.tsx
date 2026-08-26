import React, { useState, useEffect, useMemo } from 'react';
import type { UserRole, SkuItem } from '../../types';
import { tokens } from '../../theme/tokens';
import { useData } from '../../context/DataContext';

export interface DistributorItem {
  id: string;
  name: string;
  level: string;
}

export interface MappedSkuItem extends SkuItem {
  masterPrice?: number;
  overridePrice?: number | null;
  minOrderQty?: number;
}

export const SkuMappingManager: React.FC<{ role: UserRole }> = ({ role }) => {
  const { inventory } = useData();

  // Distributors State
  const [distributors, setDistributors] = useState<DistributorItem[]>([]);
  const [selectedDistributorId, setSelectedDistributorId] = useState<string>('');

  // Mapped SKUs State
  const [mappedSkus, setMappedSkus] = useState<MappedSkuItem[]>([]);
  const [loadingMapped, setLoadingMapped] = useState(false);

  // Filters State
  const [searchDistributor, setSearchDistributor] = useState('');
  const [searchCatalogSku, setSearchCatalogSku] = useState('');
  const [searchMappedSku, setSearchMappedSku] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [sourceCopyDistributorId, setSourceCopyDistributorId] = useState<string>('');

  const [savingMap, setSavingMap] = useState(false);
  const [banner, setBanner] = useState<{ text: string; type: 'error' | 'success' } | null>(null);

  // RBAC Permission Gate Check
  const hasPermission = role === 'admin' || role === 'distributor';

  // Fetch Distributors List
  useEffect(() => {
    const fetchDistributors = async () => {
      try {
        const res = await fetch('/api/v1/distributors');
        const json = await res.json();
        if (json.data && Array.isArray(json.data)) {
          setDistributors(json.data);
          if (json.data.length > 0 && !selectedDistributorId) {
            setSelectedDistributorId(json.data[0].id);
          }
        }
      } catch (_e) {
        // Standby fallback
        setDistributors([
          { id: 'dist-001', name: 'North Region Hub', level: 'REGION' },
          { id: 'dist-002', name: 'Metro Area Logistics', level: 'AREA' },
          { id: 'dist-003', name: 'Global Wholesalers Ltd', level: 'DISTRIBUTOR' }
        ]);
        if (!selectedDistributorId) setSelectedDistributorId('dist-001');
      }
    };
    fetchDistributors();
  }, []);

  // Fetch Mapped SKUs for Selected Distributor
  const fetchMappedSkus = async (distId: string) => {
    if (!distId) return;
    setLoadingMapped(true);
    try {
      const res = await fetch(`/api/v1/distributors/${distId}/skus`);
      const json = await res.json();
      if (json.data && Array.isArray(json.data)) {
        setMappedSkus(json.data);
      } else {
        setMappedSkus([]);
      }
    } catch (_e) {
      setMappedSkus([]);
    } finally {
      setLoadingMapped(false);
    }
  };

  useEffect(() => {
    if (selectedDistributorId) {
      fetchMappedSkus(selectedDistributorId);
    }
  }, [selectedDistributorId]);

  // Categories Dropdown
  const categories = useMemo(() => {
    const set = new Set<string>();
    inventory.forEach(i => set.add(i.category || 'General'));
    return ['ALL', ...Array.from(set)];
  }, [inventory]);

  // ⚡ Bolt: Hoisted string transformations (.toLowerCase()) outside filter loops
  // Expected impact: Eliminates O(N) redundant string allocations and CPU cycles on every render,
  // preventing layout thrashing and garbage collection spikes when filtering large lists.
  // Filter Distributors for Searchable Select (50+ scale)
  const filteredDistributors = useMemo(() => {
    const searchLower = searchDistributor.toLowerCase();
    return distributors.filter(d => d.name.toLowerCase().includes(searchLower) || d.id.toLowerCase().includes(searchLower));
  }, [distributors, searchDistributor]);

  // Catalog SKUs (Unmapped & Filtered)
  const availableCatalogSkus = useMemo(() => {
    const mappedIds = new Set(mappedSkus.map(m => m.sku || (m as any).code || m.name));
    const searchLower = searchCatalogSku.toLowerCase();
    return inventory.filter(item => {
      const isMapped = mappedIds.has(item.sku);
      const matchesCat = selectedCategory === 'ALL' || item.category === selectedCategory;
      const matchesSearch = item.name.toLowerCase().includes(searchLower) || item.sku.toLowerCase().includes(searchLower);
      return !isMapped && matchesCat && matchesSearch;
    });
  }, [inventory, mappedSkus, selectedCategory, searchCatalogSku]);

  // Filtered Mapped SKUs
  const filteredMappedSkus = useMemo(() => {
    const searchLower = searchMappedSku.toLowerCase();
    return mappedSkus.filter(m =>
      (m.name || '').toLowerCase().includes(searchLower) ||
      (m.sku || (m as any).code || '').toLowerCase().includes(searchLower)
    );
  }, [mappedSkus, searchMappedSku]);

  // Map Single SKU to Distributor
  const handleMapSku = async (sku: SkuItem) => {
    if (!selectedDistributorId) return;
    setSavingMap(true);
    try {
      const res = await fetch(`/api/v1/distributors/${selectedDistributorId}/skus`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skuId: sku.sku,
          overridePrice: sku.price,
          minOrderQty: 1
        })
      });
      if (res.ok) {
        setBanner({ text: `Mapped '${sku.name}' to distributor`, type: 'success' });
        fetchMappedSkus(selectedDistributorId);
      }
    } catch (_e) {
      setBanner({ text: 'Failed to map SKU', type: 'error' });
    } finally {
      setSavingMap(false);
    }
  };

  // Unmap SKU from Distributor
  const handleUnmapSku = async (skuId: string) => {
    if (!selectedDistributorId) return;

    if (!window.confirm(`Are you sure you want to unmap SKU ${skuId}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/v1/distributors/${selectedDistributorId}/skus/${skuId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setBanner({ text: 'SKU unmapped successfully', type: 'success' });
        fetchMappedSkus(selectedDistributorId);
      }
    } catch (_e) {
      setBanner({ text: 'Failed to unmap SKU', type: 'error' });
    }
  };

  // Bulk Action: Map All SKUs in Selected Category
  const handleBulkMapCategory = async () => {
    if (!selectedDistributorId || availableCatalogSkus.length === 0) return;
    setSavingMap(true);
    try {
      for (const item of availableCatalogSkus) {
        await fetch(`/api/v1/distributors/${selectedDistributorId}/skus`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ skuId: item.sku, overridePrice: item.price, minOrderQty: 1 })
        });
      }
      setBanner({ text: `Bulk mapped ${availableCatalogSkus.length} SKUs in category '${selectedCategory}'`, type: 'success' });
      fetchMappedSkus(selectedDistributorId);
    } catch (_e) {
      setBanner({ text: 'Error executing bulk category mapping', type: 'error' });
    } finally {
      setSavingMap(false);
    }
  };

  // Bulk Action: Copy Mapping From Another Distributor
  const handleBulkCopyMapping = async () => {
    if (!selectedDistributorId || !sourceCopyDistributorId) {
      setBanner({ text: 'Please select a source distributor to copy mapping from', type: 'error' });
      return;
    }
    setSavingMap(true);
    try {
      const res = await fetch(`/api/v1/distributors/${selectedDistributorId}/skus/copy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceDistributorId: sourceCopyDistributorId })
      });
      const json = await res.json();
      if (res.ok) {
        setBanner({ text: json.message || 'Bulk copied SKU mapping successfully', type: 'success' });
        fetchMappedSkus(selectedDistributorId);
      } else {
        throw new Error(json.error || 'Failed to copy mapping');
      }
    } catch (err: any) {
      setBanner({ text: err.message || 'Error executing bulk copy mapping', type: 'error' });
    } finally {
      setSavingMap(false);
    }
  };

  // Inline Editable Input Handlers
  const handleOverridePriceChange = (skuId: string, val: string) => {
    const num = parseFloat(val);
    setMappedSkus(prev => prev.map(m => m.sku === skuId ? { ...m, overridePrice: isNaN(num) ? null : num, price: isNaN(num) ? (m.masterPrice || m.price) : num } : m));
  };

  const handleMinQtyChange = (skuId: string, val: string) => {
    const num = parseInt(val, 10);
    setMappedSkus(prev => prev.map(m => m.sku === skuId ? { ...m, minOrderQty: isNaN(num) ? 1 : num } : m));
  };

  if (!hasPermission) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: '8px', margin: '24px' }}>
        <h3>🔒 Access Denied: Requires `sku_mapping:manage` Permission</h3>
        <p>Your current user role ({role}) does not have permission to manage distributor SKU catalog mappings.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', backgroundColor: tokens.colors.bgApp, minHeight: '100vh', color: tokens.colors.textBody }}>
      {/* Header & Searchable Distributor Selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: tokens.colors.textMain, margin: 0 }}>Distributor SKU Catalog Mapping Manager</h1>
          <p style={{ color: tokens.colors.textMuted, margin: '4px 0 0', fontSize: '14px' }}>
            Map master tenant SKUs to specific distributors with custom price overrides and minimum order quantities
          </p>
        </div>

        {/* Searchable Distributor Select Dropdown (50+ Scale) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#FFFFFF', padding: '8px 14px', borderRadius: '8px', border: `1px solid ${tokens.colors.border}` }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: tokens.colors.textMuted }}>Distributor:</span>
          <input
            type="text"
            value={searchDistributor}
            onChange={e => setSearchDistributor(e.target.value)}
            placeholder="Search 50+ distributors..."
            style={{ width: '160px', padding: '4px 8px', border: `1px solid ${tokens.colors.border}`, borderRadius: '4px', fontSize: '12px' }}
          />
          <select
            value={selectedDistributorId}
            onChange={e => setSelectedDistributorId(e.target.value)}
            style={{ border: 'none', background: 'transparent', fontWeight: 700, color: tokens.colors.brand, fontSize: '13px', cursor: 'pointer', outline: 'none' }}
          >
            {filteredDistributors.map(d => (
              <option key={d.id} value={d.id}>[{d.level}] {d.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Alert Banner */}
      {banner && (
        <div style={{
          backgroundColor: banner.type === 'success' ? '#DCFCE7' : '#FEE2E2',
          border: `1px solid ${banner.type === 'success' ? '#86EFAC' : '#FCA5A5'}`,
          color: banner.type === 'success' ? '#166534' : '#B91C1C',
          padding: '10px 14px',
          borderRadius: '6px',
          fontSize: '13px',
          fontWeight: 600,
          marginBottom: '16px'
        }}>
          {banner.text}
        </div>
      )}

      {/* Bulk Actions Control Bar */}
      <div style={{ backgroundColor: '#FFFFFF', padding: '14px 18px', borderRadius: '8px', border: `1px solid ${tokens.colors.border}`, marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        {/* Bulk Action 1: Map Category */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: tokens.colors.textMain }}>Bulk Action:</span>
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            style={{ padding: '6px 10px', border: `1px solid ${tokens.colors.border}`, borderRadius: '6px', fontSize: '12px' }}
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>Category: {cat}</option>
            ))}
          </select>
          <button
            onClick={handleBulkMapCategory}
            disabled={savingMap || availableCatalogSkus.length === 0}
            style={{ padding: '6px 14px', backgroundColor: tokens.colors.brand, color: '#FFFFFF', border: 'none', borderRadius: '6px', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
          >
            + Map Category ({availableCatalogSkus.length} SKUs) →
          </button>
        </div>

        {/* Bulk Action 2: Copy Mapping from Another Distributor */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: tokens.colors.textMain }}>Copy Mapping From:</span>
          <select
            value={sourceCopyDistributorId}
            onChange={e => setSourceCopyDistributorId(e.target.value)}
            style={{ padding: '6px 10px', border: `1px solid ${tokens.colors.border}`, borderRadius: '6px', fontSize: '12px' }}
          >
            <option value="">(Select Source Distributor)</option>
            {distributors.filter(d => d.id !== selectedDistributorId).map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <button
            onClick={handleBulkCopyMapping}
            disabled={savingMap || !sourceCopyDistributorId}
            style={{ padding: '6px 14px', backgroundColor: '#0F172A', color: '#FFFFFF', border: 'none', borderRadius: '6px', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
          >
            Copy Mapping →
          </button>
        </div>
      </div>

      {/* Two-Panel Dual Listbox View */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Left Panel: Master Tenant SKU Catalog */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '8px', border: `1px solid ${tokens.colors.border}`, padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: tokens.colors.textMain }}>
              📦 Master Tenant Catalog ({availableCatalogSkus.length} Unmapped)
            </h3>
            <input
              type="text"
              value={searchCatalogSku}
              onChange={e => setSearchCatalogSku(e.target.value)}
              placeholder="Search catalog SKUs..."
              style={{ width: '180px', padding: '4px 8px', border: `1px solid ${tokens.colors.border}`, borderRadius: '4px', fontSize: '12px' }}
            />
          </div>

          <div style={{ maxHeight: '550px', overflowY: 'auto' }}>
            {availableCatalogSkus.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: tokens.colors.textMuted, fontSize: '13px' }}>
                All catalog SKUs in this category are currently mapped to this distributor.
              </div>
            ) : (
              availableCatalogSkus.map(item => (
                <div key={item.sku} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderBottom: `1px solid ${tokens.colors.border}` }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '13px', color: tokens.colors.textMain }}>{item.name}</div>
                    <div style={{ fontSize: '11px', color: tokens.colors.textMuted }}>SKU: {item.sku} • Category: {item.category} • Master Price: ${item.price.toFixed(2)}</div>
                  </div>
                  <button
                    onClick={() => handleMapSku(item)}
                    disabled={savingMap}
                    style={{ padding: '4px 10px', backgroundColor: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: '4px', fontWeight: 700, fontSize: '11px', cursor: 'pointer' }}
                  >
                    + Map SKU →
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Panel: Currently Mapped SKUs with Editable Inline Fields */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '8px', border: `1px solid ${tokens.colors.border}`, padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: tokens.colors.textMain }}>
              ✅ Mapped Distributor SKUs ({filteredMappedSkus.length})
            </h3>
            <input
              type="text"
              value={searchMappedSku}
              onChange={e => setSearchMappedSku(e.target.value)}
              placeholder="Search mapped SKUs..."
              style={{ width: '180px', padding: '4px 8px', border: `1px solid ${tokens.colors.border}`, borderRadius: '4px', fontSize: '12px' }}
            />
          </div>

          <div style={{ maxHeight: '550px', overflowY: 'auto' }}>
            {loadingMapped ? (
              <div style={{ padding: '32px', textAlign: 'center', color: tokens.colors.textMuted }}>Loading mapped distributor catalog...</div>
            ) : filteredMappedSkus.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: tokens.colors.textMuted, fontSize: '13px' }}>
                No SKUs mapped to this distributor yet. Select SKUs from the left panel to map them.
              </div>
            ) : (
              filteredMappedSkus.map(m => (
                <div key={m.sku} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderBottom: `1px solid ${tokens.colors.border}` }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '13px', color: tokens.colors.textMain }}>{m.name}</div>
                    <div style={{ fontSize: '11px', color: tokens.colors.textMuted }}>SKU: {m.sku} • Master: ${m.masterPrice || m.price}</div>
                  </div>

                  {/* Inline Editable Fields: Override Price & Min Order Qty */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '10px', color: tokens.colors.textMuted, display: 'block' }}>Price ($)</span>
                      <input
                        type="number"
                        step="0.01"
                        value={m.overridePrice !== undefined && m.overridePrice !== null ? m.overridePrice : m.price}
                        onChange={e => handleOverridePriceChange(m.sku, e.target.value)}
                        style={{ width: '70px', padding: '2px 4px', fontSize: '12px', border: `1px solid ${tokens.colors.border}`, borderRadius: '4px' }}
                      />
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '10px', color: tokens.colors.textMuted, display: 'block' }}>Min Qty</span>
                      <input
                        type="number"
                        min="1"
                        value={m.minOrderQty || 1}
                        onChange={e => handleMinQtyChange(m.sku, e.target.value)}
                        style={{ width: '50px', padding: '2px 4px', fontSize: '12px', border: `1px solid ${tokens.colors.border}`, borderRadius: '4px' }}
                      />
                    </div>

                    <button
                      onClick={() => handleUnmapSku(m.sku)}
                      aria-label={`Unmap SKU ${m.sku}`}
                      style={{ padding: '4px 8px', backgroundColor: '#FEE2E2', color: '#B91C1C', border: '1px solid #FCA5A5', borderRadius: '4px', fontWeight: 700, fontSize: '11px', cursor: 'pointer', marginLeft: '4px' }}
                    >
                      ✕ Unmap
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
