import React from 'react';
import type { UserRole } from '../../types';
import { useData } from '../../context/DataContext';
import { StatusBadge } from '../../components/StatusBadge';
import { tokens } from '../../theme/tokens';

export const FieldVisits: React.FC<{ role: UserRole }> = ({ role: _role }) => {
  const { fieldVisits } = useData();

  return (
    <div style={{ padding: '24px', backgroundColor: tokens.colors.bgApp, minHeight: '100vh', color: tokens.colors.textBody }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: tokens.colors.textMain, margin: 0 }}>GPS Visit & Attendance Log</h1>
          <p style={{ color: tokens.colors.textMuted, margin: '4px 0 0', fontSize: '14px' }}>
            Real-time GPS geofenced check-in log & field rep attendance audit
          </p>
        </div>
      </div>

      <div style={{ backgroundColor: '#FFFFFF', border: `1px solid ${tokens.colors.border}`, borderRadius: '8px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: `1px solid ${tokens.colors.border}` }}>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: tokens.colors.textBody, fontSize: '13px' }}>Visit ID</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: tokens.colors.textBody, fontSize: '13px' }}>Field Agent</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: tokens.colors.textBody, fontSize: '13px' }}>Retail Outlet</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: tokens.colors.textBody, fontSize: '13px' }}>Check-In Time</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: tokens.colors.textBody, fontSize: '13px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {fieldVisits.map((v, idx) => (
              <tr key={v.id} style={{ borderBottom: idx === fieldVisits.length - 1 ? 'none' : `1px solid ${tokens.colors.border}` }}>
                <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 600 }}>{v.id}</td>
                <td style={{ padding: '12px 16px', fontWeight: 600, color: tokens.colors.textMain }}>{v.agent}</td>
                <td style={{ padding: '12px 16px', color: tokens.colors.brand }}>{v.outlet}</td>
                <td style={{ padding: '12px 16px', color: tokens.colors.textMuted }}>{v.time}</td>
                <td style={{ padding: '12px 16px' }}><StatusBadge status={v.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
