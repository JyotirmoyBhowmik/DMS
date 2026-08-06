import React, { useState, useEffect } from 'react';
import type { UserRole } from '../../types';
import { tokens } from '../../theme/tokens';

export type ChannelType = 'MART' | 'HOTEL_RESTAURANT' | 'SMALL_SHOP' | 'VAN_OPERATOR' | 'SALES_MARKETING_TEAM';

export interface ChannelFlag {
  id?: string;
  tenantId?: string;
  channelType: ChannelType;
  moduleName: string;
  enabled: boolean;
}

const CHANNEL_TYPES: { type: ChannelType; label: string; icon: string }[] = [
  { type: 'MART', label: 'Supermarket / Mart Chain', icon: '🛒' },
  { type: 'HOTEL_RESTAURANT', label: 'Hotel & Restaurant (HoReCa)', icon: '🏨' },
  { type: 'SMALL_SHOP', label: 'Small Kirana / Retail Shop', icon: '🏪' },
  { type: 'VAN_OPERATOR', label: 'Distribution Van Operator', icon: '🚚' },
  { type: 'SALES_MARKETING_TEAM', label: 'Sales & Marketing Field Team', icon: '🎯' },
];

const MODULE_LIST: { id: string; name: string; description: string }[] = [
  { id: 'bulk_order', name: 'Bulk Order Entry', description: 'Allows high-volume bulk SKU ordering and matrix grid inputs' },
  { id: 'van_sale', name: 'Spot Van Sales', description: 'Enables mobile inventory loading and spot invoice generation' },
  { id: 'pricing_schemes', name: 'Promotional Trade Schemes', description: 'Access to volume discounts and promotional rebate schemes' },
  { id: 'ai_forecast', name: 'AI Demand Forecasting', description: 'ML-driven stock replenishment and predictive order suggestions' },
  { id: 'geo_checkin', name: 'GPS Geofenced Check-In', description: 'Real-time agent check-in & attendance verification' },
  { id: 'claims', name: 'Trade Claims & Rebates', description: 'Filing and reconciliation of distributor rebate claims' },
];

export const ChannelFlagMatrix: React.FC<{ role: UserRole }> = ({ role: _role }) => {
  const [flags, setFlags] = useState<ChannelFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchFlags = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/channel-flags');
      const json = await res.json();
      if (json.data && Array.isArray(json.data)) {
        setFlags(json.data);
      } else {
        setFlags([]);
      }
    } catch (_err) {
      setFlags([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlags();
  }, []);

  const isModuleEnabled = (channelType: ChannelType, moduleName: string): boolean => {
    const found = flags.find(f => f.channelType === channelType && f.moduleName === moduleName);
    if (found !== undefined) return found.enabled;
    // Default fallback rules
    if (channelType === 'MART') return true;
    if (channelType === 'SMALL_SHOP' && moduleName === 'bulk_order') return false;
    if (channelType === 'VAN_OPERATOR' && moduleName === 'van_sale') return true;
    return true;
  };

  const handleToggleFlag = async (channelType: ChannelType, moduleName: string, currentEnabled: boolean) => {
    const nextEnabled = !currentEnabled;
    const key = `${channelType}-${moduleName}`;
    setUpdating(key);

    try {
      const res = await fetch('/api/v1/channel-flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelType,
          moduleName,
          enabled: nextEnabled,
        }),
      });

      if (res.ok) {
        setFlags(prev => {
          const filtered = prev.filter(f => !(f.channelType === channelType && f.moduleName === moduleName));
          return [...filtered, { channelType, moduleName, enabled: nextEnabled }];
        });
      }
    } catch (_err) {
      // Ignore
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div style={{ padding: '24px', backgroundColor: tokens.colors.bgApp, minHeight: '100vh', color: tokens.colors.textBody }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: tokens.colors.textMain, margin: 0 }}>Outlet Channel Module Matrix</h1>
          <p style={{ color: tokens.colors.textMuted, margin: '4px 0 0', fontSize: '14px' }}>
            Tenant feature-flags controlling module visibility per channel type (MART, HoReCa, Kirana, Van, Sales Team)
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '32px', textAlign: 'center', color: tokens.colors.textMuted }}>Loading channel feature flags...</div>
      ) : (
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '8px', border: `1px solid ${tokens.colors.border}`, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: `1px solid ${tokens.colors.border}` }}>
                <th style={{ padding: '14px 16px', fontWeight: 600, color: tokens.colors.textBody, fontSize: '13px', width: '280px' }}>Module Name</th>
                {CHANNEL_TYPES.map(ch => (
                  <th key={ch.type} style={{ padding: '14px 12px', fontWeight: 600, color: tokens.colors.textMain, fontSize: '12px', textAlign: 'center' }}>
                    <div>{ch.icon} {ch.type}</div>
                    <div style={{ fontSize: '10px', color: tokens.colors.textMuted, fontWeight: 400 }}>{ch.label}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODULE_LIST.map((mod, idx) => (
                <tr key={mod.id} style={{ borderBottom: idx === MODULE_LIST.length - 1 ? 'none' : `1px solid ${tokens.colors.border}` }}>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ fontWeight: 700, color: tokens.colors.textMain, fontSize: '14px' }}>{mod.name}</div>
                    <div style={{ fontSize: '12px', color: tokens.colors.textMuted, marginTop: '2px' }}>{mod.description}</div>
                  </td>
                  {CHANNEL_TYPES.map(ch => {
                    const enabled = isModuleEnabled(ch.type, mod.id);
                    const key = `${ch.type}-${mod.id}`;
                    const isUpdating = updating === key;

                    return (
                      <td key={ch.type} style={{ padding: '14px 12px', textAlign: 'center' }}>
                        <button
                          onClick={() => handleToggleFlag(ch.type, mod.id, enabled)}
                          disabled={isUpdating}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '20px',
                            border: `1px solid ${enabled ? '#86EFAC' : '#CBD5E1'}`,
                            backgroundColor: enabled ? '#DCFCE7' : '#F1F5F9',
                            color: enabled ? '#15803D' : '#64748B',
                            fontWeight: 700,
                            fontSize: '11px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          {isUpdating ? '...' : enabled ? '✓ ON' : '✕ OFF'}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
