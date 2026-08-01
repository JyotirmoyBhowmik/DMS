import React from 'react';
import { UserRole } from '../../types';
import { SEED_FIELD_VISITS } from '../../data/seed';
import { StatusBadge } from '../../components/StatusBadge';

export const FieldVisits: React.FC<{ role: UserRole }> = ({ role }) => {
  const myAgentName = "Agent One";
  
  const visibleVisits = role === 'agent' 
    ? SEED_FIELD_VISITS.filter((v: any) => v.agentName === myAgentName)
    : SEED_FIELD_VISITS;

  const totalVisits = visibleVisits.length;
  const completedVisits = visibleVisits.filter((v: any) => v.status === 'COMPLETED').length;
  const compliance = totalVisits > 0 ? ((completedVisits / totalVisits) * 100).toFixed(1) : '0.0';

  return (
    <div style={{ padding: '24px', backgroundColor: '#F8FAFC', minHeight: '100vh', color: '#334155' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#0F172A', marginBottom: '24px' }}>Field Visits</h1>
      
      <div style={{ backgroundColor: '#FFFFFF', padding: '16px', borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: '24px', width: 'fit-content' }}>
        <div style={{ color: '#64748B', fontSize: '14px', marginBottom: '8px' }}>Visit Compliance</div>
        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#15803D' }}>{compliance}%</div>
      </div>

      <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
            <tr>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Agent</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Retail Outlet</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Time</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {visibleVisits.map((v: any) => (
              <tr key={v.id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                <td style={{ padding: '12px 16px' }}>{v.agentName}</td>
                <td style={{ padding: '12px 16px' }}>{v.outletName}</td>
                <td style={{ padding: '12px 16px' }}>{v.time}</td>
                <td style={{ padding: '12px 16px' }}>
                  <StatusBadge status={v.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
