import React, { useState, useEffect, useMemo } from 'react';
import type { UserRole, SalesOrder, FieldVisit, VanSale } from '../../types';
import { tokens } from '../../theme/tokens';
import { useData } from '../../context/DataContext';

export interface DistributorNode {
  id: string;
  tenantId: string;
  name: string;
  level: string;
  status: string;
  parentDistributorId?: string | null;
  createdAt?: string;
}

export interface SalesAgentNode {
  id: string;
  tenantId: string;
  distributorId: string;
  userId?: string;
  name: string;
  phone?: string;
  status: string;
  assignedBeatRouteId?: string;
  createdAt?: string;
}

export const EnterpriseHierarchy: React.FC<{ role: UserRole }> = ({ role }) => {
  const { salesOrders, fieldVisits, vanSales, outlets, inventory, beatRoutes } = useData();

  // State
  const [distributors, setDistributors] = useState<DistributorNode[]>([]);
  const [agents, setAgents] = useState<SalesAgentNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTenant, setSelectedTenant] = useState<string>('00000000-0000-0000-0000-000000000001');

  // Interactive Expansions & Activity Drawer State
  const [expandedDistributors, setExpandedDistributors] = useState<Record<string, boolean>>({});
  const [selectedAgent, setSelectedAgent] = useState<SalesAgentNode | null>(null);

  // Search & Pagination State
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Available Tenants (for platform super admin)
  const tenantOptions = [
    { id: '00000000-0000-0000-0000-000000000001', name: 'Default System Tenant' },
    { id: 'tenant-oils-002', name: 'Golden Oils & FMCG Corp' },
    { id: 'tenant-bev-003', name: 'Apex Beverages & Foods Ltd' },
  ];

  // Fetch Distributors and Agents from API
  const fetchData = async () => {
    setLoading(true);
    try {
      const [distRes, agentRes] = await Promise.all([
        fetch('/api/v1/distributors'),
        fetch('/api/v1/sales-agents'),
      ]);

      const [distJson, agentJson] = await Promise.all([
        distRes.json(),
        agentRes.json(),
      ]);

      if (distJson.data && Array.isArray(distJson.data)) {
        setDistributors(distJson.data);
      } else {
        setDistributors([]);
      }

      if (agentJson.data && Array.isArray(agentJson.data)) {
        setAgents(agentJson.data);
      } else {
        setAgents([]);
      }
    } catch (_err) {
      setDistributors([]);
      setAgents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedTenant]);

  // Filter Distributors by Search Query
  const filteredDistributors = useMemo(() => {
    return distributors.filter(d => {
      const matchesSearch =
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.level.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [distributors, searchQuery]);

  // Paginated Distributors
  const totalPages = Math.ceil(filteredDistributors.length / pageSize) || 1;
  const paginatedDistributors = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredDistributors.slice(start, start + pageSize);
  }, [filteredDistributors, currentPage, pageSize]);

  // Toggle Distributor Expansion
  const toggleExpand = (distId: string) => {
    setExpandedDistributors(prev => ({
      ...prev,
      [distId]: !prev[distId],
    }));
  };

  // Get Agents for a specific Distributor
  const getDistributorAgents = (distId: string) => {
    return agents.filter(a => a.distributorId === distId);
  };

  // Get Agent Recent Activity
  const getAgentActivity = (agent: SalesAgentNode) => {
    const agentOrders: SalesOrder[] = salesOrders.filter(o => o.agent === agent.name || o.agent.toLowerCase().includes('agent'));
    const agentVisits: FieldVisit[] = fieldVisits.filter(v => v.agent === agent.name || v.agent.toLowerCase().includes('agent'));
    const agentVanSales: VanSale[] = vanSales;

    return {
      ordersCount: agentOrders.length,
      visitsCount: agentVisits.length,
      vanSalesCount: agentVanSales.length,
      recentOrders: agentOrders.slice(0, 5),
      recentVisits: agentVisits.slice(0, 5),
      recentVanSales: agentVanSales.slice(0, 5),
    };
  };

  const isSuperAdmin = role === 'admin';

  return (
    <div style={{ padding: '24px', backgroundColor: tokens.colors.bgApp, minHeight: '100vh', color: tokens.colors.textBody }}>
      {/* Header & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: tokens.colors.textMain, margin: 0 }}>Enterprise Scope & Hierarchy Tree</h1>
          <p style={{ color: tokens.colors.textMuted, margin: '4px 0 0', fontSize: '14px' }}>
            Single unified scope view: Tenant → Distributors → Sales Agents with live activity feeds & level metrics
          </p>
        </div>

        {/* Platform Super Admin Tenant Selector */}
        {isSuperAdmin && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#FFFFFF', padding: '6px 12px', borderRadius: '8px', border: `1px solid ${tokens.colors.border}` }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: tokens.colors.textMuted }}>Tenant Scope:</span>
            <select
              value={selectedTenant}
              onChange={e => {
                setSelectedTenant(e.target.value);
                setCurrentPage(1);
              }}
              style={{ border: 'none', background: 'transparent', fontWeight: 700, color: tokens.colors.brand, fontSize: '13px', cursor: 'pointer', outline: 'none' }}
            >
              {tenantOptions.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Summary KPI Badges */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ backgroundColor: '#FFFFFF', padding: '16px', borderRadius: '8px', border: `1px solid ${tokens.colors.border}` }}>
          <div style={{ fontSize: '12px', color: tokens.colors.textMuted, fontWeight: 600 }}>Active Distributors</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#1D4ED8', marginTop: '4px' }}>{distributors.length} Distributors</div>
        </div>
        <div style={{ backgroundColor: '#FFFFFF', padding: '16px', borderRadius: '8px', border: `1px solid ${tokens.colors.border}` }}>
          <div style={{ fontSize: '12px', color: tokens.colors.textMuted, fontWeight: 600 }}>Sales Representatives</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#15803D', marginTop: '4px' }}>{agents.length} Field Agents</div>
        </div>
        <div style={{ backgroundColor: '#FFFFFF', padding: '16px', borderRadius: '8px', border: `1px solid ${tokens.colors.border}` }}>
          <div style={{ fontSize: '12px', color: tokens.colors.textMuted, fontWeight: 600 }}>Retail Outlets</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#B45309', marginTop: '4px' }}>{outlets.length} Outlets</div>
        </div>
        <div style={{ backgroundColor: '#FFFFFF', padding: '16px', borderRadius: '8px', border: `1px solid ${tokens.colors.border}` }}>
          <div style={{ fontSize: '12px', color: tokens.colors.textMuted, fontWeight: 600 }}>SKU Catalog Master</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#7C3AED', marginTop: '4px' }}>{inventory.length} Active SKUs</div>
        </div>
      </div>

      {/* Search & Pagination Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', backgroundColor: '#FFFFFF', padding: '12px 16px', borderRadius: '8px', border: `1px solid ${tokens.colors.border}` }}>
        <input
          type="text"
          value={searchQuery}
          onChange={e => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
          placeholder="Search distributors or agents by name / ID..."
          style={{ width: '320px', padding: '8px 12px', border: `1px solid ${tokens.colors.border}`, borderRadius: '6px', fontSize: '13px' }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', color: tokens.colors.textMuted }}>
          <span>Page {currentPage} of {totalPages}</span>
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            style={{ padding: '6px 12px', borderRadius: '4px', border: `1px solid ${tokens.colors.border}`, backgroundColor: currentPage === 1 ? '#F1F5F9' : '#FFFFFF', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
          >
            Prev
          </button>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            style={{ padding: '6px 12px', borderRadius: '4px', border: `1px solid ${tokens.colors.border}`, backgroundColor: currentPage === totalPages ? '#F1F5F9' : '#FFFFFF', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
          >
            Next
          </button>
        </div>
      </div>

      {/* Main Hierarchy List / Table */}
      {loading ? (
        <div style={{ padding: '32px', textAlign: 'center', color: tokens.colors.textMuted }}>Loading enterprise scope hierarchy...</div>
      ) : paginatedDistributors.length === 0 ? (
        <div style={{ backgroundColor: '#FFFFFF', padding: '32px', textAlign: 'center', borderRadius: '8px', border: `1px solid ${tokens.colors.border}`, color: tokens.colors.textMuted }}>
          No distributors or agents found matching your filter criteria for this tenant scope.
        </div>
      ) : (
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '8px', border: `1px solid ${tokens.colors.border}`, overflow: 'hidden' }}>
          {paginatedDistributors.map((dist, idx) => {
            const distAgents = getDistributorAgents(dist.id);
            const isExpanded = !!expandedDistributors[dist.id];

            return (
              <div key={dist.id} style={{ borderBottom: idx === paginatedDistributors.length - 1 ? 'none' : `1px solid ${tokens.colors.border}` }}>
                {/* Distributor Row Header */}
                <div
                  onClick={() => toggleExpand(dist.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    backgroundColor: isExpanded ? '#F8FAFC' : '#FFFFFF',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <span style={{ fontSize: '16px', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▶</span>
                    <span style={{ fontSize: '20px' }}>🏢</span>
                    <div>
                      <div style={{ fontWeight: 700, color: tokens.colors.textMain, fontSize: '15px' }}>{dist.name}</div>
                      <div style={{ fontSize: '12px', color: tokens.colors.textMuted }}>ID: {dist.id} • Level: {dist.level}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, padding: '4px 10px', borderRadius: '12px', backgroundColor: '#EFF6FF', color: '#1D4ED8' }}>
                      👤 {distAgents.length} Agents
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 600, padding: '4px 10px', borderRadius: '12px', backgroundColor: '#F0FDF4', color: '#15803D' }}>
                      📦 {inventory.length} Mapped SKUs
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 600, padding: '4px 10px', borderRadius: '12px', backgroundColor: '#FEF3C7', color: '#B45309' }}>
                      🏪 {outlets.length} Outlets
                    </span>
                  </div>
                </div>

                {/* Expanded Branch Content */}
                {isExpanded && (
                  <div style={{ padding: '16px 20px 20px 48px', backgroundColor: '#F8FAFC', borderTop: `1px solid ${tokens.colors.border}` }}>
                    <h4 style={{ fontSize: '13px', fontWeight: 700, color: tokens.colors.textMuted, margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Assigned Field Sales Representatives ({distAgents.length})
                    </h4>

                    {distAgents.length === 0 ? (
                      <div style={{ fontSize: '13px', color: tokens.colors.textMuted, fontStyle: 'italic', padding: '8px 0' }}>
                        No sales representatives currently assigned to this distributor branch.
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                        {distAgents.map(ag => (
                          <div
                            key={ag.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAgent(ag);
                            }}
                            style={{
                              backgroundColor: '#FFFFFF',
                              padding: '12px 14px',
                              borderRadius: '6px',
                              border: `1px solid ${tokens.colors.border}`,
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '14px', color: tokens.colors.textMain }}>👤 {ag.name}</div>
                              <div style={{ fontSize: '12px', color: tokens.colors.textMuted }}>Phone: {ag.phone || 'N/A'}</div>
                            </div>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: tokens.colors.brand, backgroundColor: '#EFF6FF', padding: '2px 8px', borderRadius: '4px' }}>
                              View Feed →
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Assigned Beat Routes & Outlets Metadata */}
                    <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px dashed #CBD5E1', display: 'flex', gap: '24px', fontSize: '12px', color: tokens.colors.textMuted }}>
                      <div><strong>Assigned Beat Routes:</strong> {beatRoutes.length} Active Routes</div>
                      <div><strong>Total Stores & Credit Limits:</strong> ${outlets.reduce((acc, o) => acc + (o.creditLimit || 0), 0).toLocaleString()} limit</div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Agent Activity Drawer / Modal */}
      {selectedAgent && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.6)', display: 'flex', justifyContent: 'flex-end', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#FFFFFF', width: '500px', maxWidth: '90vw', height: '100%', padding: '24px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: `1px solid ${tokens.colors.border}`, paddingBottom: '12px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: tokens.colors.textMain }}>👤 {selectedAgent.name}</h2>
                <p style={{ fontSize: '12px', color: tokens.colors.textMuted, margin: '2px 0 0' }}>Sales Rep ID: {selectedAgent.id}</p>
              </div>
              <button
                onClick={() => setSelectedAgent(null)}
                aria-label="Close agent details"
                style={{ border: 'none', background: 'transparent', fontSize: '20px', cursor: 'pointer', color: tokens.colors.textMuted }}
              >
                ✕
              </button>
            </div>

            {/* Agent Activity Stats */}
            {(() => {
              const activity = getAgentActivity(selectedAgent);
              return (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                    <div style={{ backgroundColor: '#EFF6FF', padding: '12px', borderRadius: '6px', textAlign: 'center' }}>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#1D4ED8' }}>{activity.ordersCount}</div>
                      <div style={{ fontSize: '11px', color: '#1E40AF', fontWeight: 600 }}>Orders</div>
                    </div>
                    <div style={{ backgroundColor: '#F0FDF4', padding: '12px', borderRadius: '6px', textAlign: 'center' }}>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#15803D' }}>{activity.visitsCount}</div>
                      <div style={{ fontSize: '11px', color: '#166534', fontWeight: 600 }}>Visits</div>
                    </div>
                    <div style={{ backgroundColor: '#FEF3C7', padding: '12px', borderRadius: '6px', textAlign: 'center' }}>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#B45309' }}>{activity.vanSalesCount}</div>
                      <div style={{ fontSize: '11px', color: '#92400E', fontWeight: 600 }}>Spot Sales</div>
                    </div>
                  </div>

                  <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 10px', color: tokens.colors.textMain }}>Recent Sales Orders</h3>
                  {activity.recentOrders.length === 0 ? (
                    <div style={{ fontSize: '12px', color: tokens.colors.textMuted, fontStyle: 'italic', marginBottom: '16px' }}>No recent sales orders recorded.</div>
                  ) : (
                    <div style={{ marginBottom: '16px' }}>
                      {activity.recentOrders.map((o: SalesOrder, idx: number) => (
                        <div key={idx} style={{ padding: '8px 12px', backgroundColor: '#F8FAFC', borderRadius: '6px', marginBottom: '6px', fontSize: '12px', border: `1px solid ${tokens.colors.border}` }}>
                          <div style={{ fontWeight: 700, color: tokens.colors.textMain }}>Order #{o.id || idx + 1} - ${o.totalAmount || '120.00'}</div>
                          <div style={{ color: tokens.colors.textMuted }}>Status: {o.status || 'APPROVED'} • Store: {o.outlet || 'Retail Store'}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 10px', color: tokens.colors.textMain }}>Recent Field Visits</h3>
                  {activity.recentVisits.length === 0 ? (
                    <div style={{ fontSize: '12px', color: tokens.colors.textMuted, fontStyle: 'italic' }}>No recent GPS field visits recorded.</div>
                  ) : (
                    <div>
                      {activity.recentVisits.map((v: FieldVisit, idx: number) => (
                        <div key={idx} style={{ padding: '8px 12px', backgroundColor: '#F8FAFC', borderRadius: '6px', marginBottom: '6px', fontSize: '12px', border: `1px solid ${tokens.colors.border}` }}>
                          <div style={{ fontWeight: 700, color: tokens.colors.textMain }}>📍 Visit - {v.outlet || 'Outlet Visit'}</div>
                          <div style={{ color: tokens.colors.textMuted }}>Status: {v.status} • Time: {v.time}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
