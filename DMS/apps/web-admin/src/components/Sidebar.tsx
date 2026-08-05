// ── Role-Aware Sidebar Navigation ──

import React from 'react';
import type { RouteId, UserRole, NavItem } from '../types';
import { NAV_ITEMS } from '../data/seed';

interface SidebarProps {
  activeRoute: RouteId;
  currentRole: UserRole;
  tenantName: string;
  tenants: { id: string; name: string }[];
  onNavigate: (route: RouteId) => void;
  onTenantChange: (name: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeRoute,
  currentRole,
  tenantName,
  tenants,
  onNavigate,
  onTenantChange,
}) => {
  // Filter menu items by current role
  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(currentRole));

  // Group items by section
  const sections: Record<string, NavItem[]> = {};
  for (const item of visibleItems) {
    if (!sections[item.section]) {
      sections[item.section] = [];
    }
    sections[item.section].push(item);
  }

  return (
    <aside
      style={{
        width: '260px',
        backgroundColor: '#FFFFFF',
        borderRight: '1px solid #E2E8F0',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        flexShrink: 0,
      }}
    >
      {/* Brand Header */}
      <div
        style={{
          padding: '20px',
          borderBottom: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            backgroundColor: '#0F172A',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: '800',
            fontSize: '18px',
          }}
        >
          D
        </div>
        <div>
          <div style={{ fontWeight: '700', fontSize: '14px', color: '#0F172A' }}>
            DMS & SFA PLATFORM
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '500' }}>
            19 Microservices • Enterprise
          </div>
        </div>
      </div>

      {/* Tenant Selector */}
      <div
        style={{
          padding: '14px 20px',
          backgroundColor: '#F8FAFC',
          borderBottom: '1px solid #E2E8F0',
        }}
      >
        <div
          style={{
            fontSize: '10px',
            fontWeight: '700',
            color: '#64748B',
            textTransform: 'uppercase',
            marginBottom: '6px',
            letterSpacing: '0.5px',
          }}
        >
          Tenant Context
        </div>
        <select
          value={tenantName}
          onChange={(e) => onTenantChange(e.target.value)}
          style={{
            width: '100%',
            padding: '7px 10px',
            borderRadius: '6px',
            border: '1px solid #CBD5E1',
            backgroundColor: '#FFFFFF',
            fontSize: '12px',
            fontWeight: '600',
            color: '#0F172A',
            outline: 'none',
          }}
        >
          {tenants.map((t) => (
            <option key={t.id} value={t.name}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {/* Role indicator */}
      <div style={{ padding: '10px 20px', borderBottom: '1px solid #E2E8F0' }}>
        <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
          Active Role
        </div>
        <span
          style={{
            display: 'inline-block',
            backgroundColor: currentRole === 'admin' ? '#EFF6FF' : currentRole === 'agent' ? '#DCFCE7' : currentRole === 'distributor' ? '#FEF3C7' : '#F1F5F9',
            color: currentRole === 'admin' ? '#1D4ED8' : currentRole === 'agent' ? '#15803D' : currentRole === 'distributor' ? '#B45309' : '#475569',
            padding: '3px 10px',
            borderRadius: '4px',
            fontWeight: '700',
            fontSize: '11px',
            textTransform: 'uppercase',
          }}
        >
          {currentRole}
        </span>
      </div>

      {/* Navigation Sections */}
      <nav
        style={{
          padding: '12px',
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
        }}
      >
        {Object.entries(sections).map(([sectionName, items]) => (
          <div key={sectionName} style={{ marginBottom: '8px' }}>
            <div
              style={{
                fontSize: '10px',
                fontWeight: '700',
                color: '#94A3B8',
                textTransform: 'uppercase',
                letterSpacing: '0.6px',
                padding: '8px 12px 4px',
              }}
            >
              {sectionName}
            </div>
            {items.map((item) => {
              const isActive = activeRoute === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: isActive ? '#0F172A' : 'transparent',
                    color: isActive ? '#FFFFFF' : '#334155',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '13px',
                    fontWeight: isActive ? '600' : '500',
                    transition: 'all 0.12s ease',
                  }}
                >
                  <span style={{ fontSize: '16px', lineHeight: 1 }}>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div
        style={{
          padding: '14px 20px',
          borderTop: '1px solid #E2E8F0',
          backgroundColor: '#F8FAFC',
          fontSize: '11px',
          color: '#64748B',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span>Build</span>
          <span
            style={{
              fontWeight: '600',
              color: '#166534',
              backgroundColor: '#DCFCE7',
              padding: '1px 8px',
              borderRadius: '10px',
            }}
          >
            STABLE
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Nodes</span>
          <span style={{ fontWeight: '600', color: '#0F172A' }}>29/29</span>
        </div>
      </div>
    </aside>
  );
};
