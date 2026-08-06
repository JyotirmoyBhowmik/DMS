import React, { useState, useEffect } from 'react';
import type { UserRole } from '../../types';
import { tokens } from '../../theme/tokens';

export interface DistributorNode {
  id: string;
  tenantId: string;
  parentDistributorId: string | null;
  name: string;
  level: 'REGION' | 'AREA' | 'DISTRIBUTOR' | 'DEPOT';
  status: 'ACTIVE' | 'INACTIVE';
  createdAt?: string;
  children?: DistributorNode[];
}

export const DistributorHierarchy: React.FC<{ role: UserRole }> = ({ role: _role }) => {
  const [distributors, setDistributors] = useState<DistributorNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [level, setLevel] = useState<'REGION' | 'AREA' | 'DISTRIBUTOR' | 'DEPOT'>('DISTRIBUTOR');
  const [parentDistributorId, setParentDistributorId] = useState<string>('');

  const fetchDistributors = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/distributors', {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const json = await res.json();
      if (json.data && Array.isArray(json.data)) {
        setDistributors(json.data);
      } else {
        setDistributors([]);
      }
    } catch (_err) {
      setDistributors([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDistributors();
  }, []);

  const handleAddDistributor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorBanner('Distributor name is required');
      return;
    }

    setSubmitting(true);
    setErrorBanner(null);

    try {
      const res = await fetch('/api/v1/distributors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          level,
          parentDistributorId: parentDistributorId || null,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to add distributor');
      }

      setShowModal(false);
      setName('');
      setLevel('DISTRIBUTOR');
      setParentDistributorId('');
      fetchDistributors();
    } catch (err: any) {
      setErrorBanner(err.message || 'An error occurred while creating distributor');
    } finally {
      setSubmitting(false);
    }
  };

  // Build Tree Data Structure
  const buildTree = (nodes: DistributorNode[]): DistributorNode[] => {
    const map = new Map<string, DistributorNode>();
    const roots: DistributorNode[] = [];

    nodes.forEach(node => {
      map.set(node.id, { ...node, children: [] });
    });

    nodes.forEach(node => {
      const current = map.get(node.id)!;
      if (node.parentDistributorId && map.has(node.parentDistributorId)) {
        map.get(node.parentDistributorId)!.children!.push(current);
      } else {
        roots.push(current);
      }
    });

    return roots;
  };

  const treeData = buildTree(distributors);

  const getLevelBadgeColor = (lvl: string) => {
    switch (lvl) {
      case 'REGION': return { bg: '#DBEAFE', text: '#1E40AF', border: '#93C5FD' };
      case 'AREA': return { bg: '#E0E7FF', text: '#3730A3', border: '#A5B4FC' };
      case 'DISTRIBUTOR': return { bg: '#DCFCE7', text: '#166534', border: '#86EFAC' };
      case 'DEPOT': return { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' };
      default: return { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' };
    }
  };

  const renderTreeNode = (node: DistributorNode, depth = 0) => {
    const badge = getLevelBadgeColor(node.level);
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={node.id} style={{ marginLeft: depth > 0 ? '24px' : '0px', marginTop: '12px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 16px',
          backgroundColor: depth === 0 ? '#F8FAFC' : '#FFFFFF',
          border: `1px solid ${tokens.colors.border}`,
          borderRadius: '8px',
          boxShadow: depth === 0 ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
        }}>
          <span style={{ fontSize: '18px' }}>{depth === 0 ? '🏛️' : depth === 1 ? '🏢' : depth === 2 ? '🏬' : '📦'}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: tokens.colors.textMain, fontSize: '14px' }}>{node.name}</div>
            <div style={{ fontSize: '12px', color: tokens.colors.textMuted }}>ID: {node.id}</div>
          </div>
          <span style={{
            padding: '2px 8px',
            fontSize: '11px',
            fontWeight: 700,
            borderRadius: '4px',
            backgroundColor: badge.bg,
            color: badge.text,
            border: `1px solid ${badge.border}`
          }}>
            {node.level}
          </span>
          <button
            onClick={() => {
              setParentDistributorId(node.id);
              setShowModal(true);
            }}
            style={{
              padding: '4px 10px',
              backgroundColor: '#EFF6FF',
              color: '#1D4ED8',
              border: '1px solid #BFDBFE',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 600,
            }}
          >
            + Add Child Node
          </button>
        </div>

        {hasChildren && (
          <div style={{ borderLeft: '2px dashed #CBD5E1', marginLeft: '12px', paddingLeft: '8px' }}>
            {node.children!.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ padding: '24px', backgroundColor: tokens.colors.bgApp, minHeight: '100vh', color: tokens.colors.textBody }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: tokens.colors.textMain, margin: 0 }}>Distributor Hierarchy Tree</h1>
          <p style={{ color: tokens.colors.textMuted, margin: '4px 0 0', fontSize: '14px' }}>
            Tenant-scoped supply chain distribution network (REGION → AREA → DISTRIBUTOR → DEPOT)
          </p>
        </div>
        <button
          onClick={() => {
            setParentDistributorId('');
            setShowModal(true);
          }}
          style={{
            backgroundColor: tokens.colors.brand,
            color: '#FFFFFF',
            padding: '10px 16px',
            borderRadius: '6px',
            border: 'none',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          + Add Root Region / Node
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '32px', textAlign: 'center', color: tokens.colors.textMuted }}>Loading distributor hierarchy from database...</div>
      ) : treeData.length === 0 ? (
        <div style={{ backgroundColor: '#FFFFFF', padding: '32px', textAlign: 'center', borderRadius: '8px', border: `1px solid ${tokens.colors.border}`, color: tokens.colors.textMuted }}>
          No distributor hierarchy nodes found for your tenant. Click "+ Add Root Region / Node" to begin building your supply chain tree.
        </div>
      ) : (
        <div style={{ backgroundColor: '#FFFFFF', padding: '20px', borderRadius: '8px', border: `1px solid ${tokens.colors.border}` }}>
          {treeData.map(rootNode => renderTreeNode(rootNode, 0))}
        </div>
      )}

      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', padding: '24px', width: '450px', maxWidth: '90vw' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 16px' }}>Add Distributor Node</h2>
            {errorBanner && (
              <div style={{ backgroundColor: '#FEE2E2', border: '1px solid #FCA5A5', color: '#B91C1C', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', marginBottom: '12px' }}>
                {errorBanner}
              </div>
            )}
            <form onSubmit={handleAddDistributor}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Distributor Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Metro Area Logistics Ltd"
                  style={{ width: '100%', padding: '8px 12px', border: `1px solid ${tokens.colors.border}`, borderRadius: '6px' }}
                  required
                />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Hierarchy Level</label>
                <select
                  value={level}
                  onChange={e => setLevel(e.target.value as any)}
                  style={{ width: '100%', padding: '8px 12px', border: `1px solid ${tokens.colors.border}`, borderRadius: '6px' }}
                >
                  <option value="REGION">REGION (Regional Hub)</option>
                  <option value="AREA">AREA (Area Manager)</option>
                  <option value="DISTRIBUTOR">DISTRIBUTOR (Wholesaler)</option>
                  <option value="DEPOT">DEPOT (Local Fulfillment Depot)</option>
                </select>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Parent Node (Optional)</label>
                <select
                  value={parentDistributorId}
                  onChange={e => setParentDistributorId(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', border: `1px solid ${tokens.colors.border}`, borderRadius: '6px' }}
                >
                  <option value="">(None - Root Node)</option>
                  {distributors.map(d => (
                    <option key={d.id} value={d.id}>[{d.level}] {d.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: `1px solid ${tokens.colors.border}`, backgroundColor: '#FFFFFF', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: tokens.colors.brand, color: '#FFFFFF', fontWeight: 600, cursor: 'pointer' }}
                >
                  {submitting ? 'Creating...' : 'Create Node'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
