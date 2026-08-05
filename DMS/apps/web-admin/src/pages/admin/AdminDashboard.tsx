import React from 'react';
import { UserRole } from '../../types';
import { StatCard } from '../../components/StatCard';

interface AdminDashboardProps {
  role: UserRole;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ role }) => {
  const containerStyle: React.CSSProperties = { padding: '24px', backgroundColor: '#F8FAFC', minHeight: '100vh', color: '#334155' };
  const headerStyle: React.CSSProperties = { fontSize: '24px', fontWeight: 'bold', color: '#0F172A', marginBottom: '24px' };
  const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '24px' };
  const cardStyle: React.CSSProperties = { backgroundColor: '#FFFFFF', padding: '20px', borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' };
  const chartContainerStyle: React.CSSProperties = { ...cardStyle, marginBottom: '24px' };
  const terminalStyle: React.CSSProperties = { backgroundColor: '#0F172A', color: '#F8FAFC', padding: '16px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '14px', marginTop: '24px' };
  const progressContainerStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '12px' };

  let headerText = 'Admin Dashboard';
  if (role === 'agent') headerText = 'My Targets';
  if (role === 'distributor') headerText = 'My Stock';

  const services = [
    { name: 'api-gateway', load: 92 },
    { name: 'dms-core', load: 74 },
    { name: 'sfa-service', load: 55 },
    { name: 'audit', load: 45 },
    { name: 'pricing', load: 31 },
  ];

  return (
    <div style={containerStyle}>
      <h1 style={headerStyle}>{headerText}</h1>
      <div style={gridStyle}>
        <StatCard label="Primary Sales Volume" value="$142,520" change="+12.5%" changeType="positive" subtitle="vs last month" />
        <StatCard label="Field Visit Compliance" value="98.2%" change="+2.1%" changeType="positive" subtitle="vs target" />
        <StatCard label="Sync Queue Backlog" value="0 Pending" change="0" changeType="neutral" subtitle="active items" />
        <StatCard label="Audit Integrity" value="VERIFIED" change="100%" changeType="positive" subtitle="system state" />
      </div>
      
      <div style={chartContainerStyle}>
        <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#0F172A' }}>7-Day Sales Trend</h2>
        <div style={{ display: 'flex', alignItems: 'flex-end', height: '150px', gap: '12px' }}>
          {[40, 60, 30, 80, 50, 90, 70].map((h, i) => (
            <div key={i} style={{ flex: 1, backgroundColor: '#2563EB', height: `${h}%`, borderRadius: '4px 4px 0 0' }} />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '12px', color: '#64748B' }}>
          <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
        </div>
      </div>

      <div style={gridStyle}>
        <div style={cardStyle}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#0F172A' }}>Service Load</h2>
          <div style={progressContainerStyle}>
            {services.map(s => (
              <div key={s.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span>{s.name}</span><span>{s.load}%</span>
                </div>
                <div style={{ width: '100%', backgroundColor: '#E2E8F0', height: '8px', borderRadius: '4px' }}>
                  <div style={{ width: `${s.load}%`, backgroundColor: '#2563EB', height: '100%', borderRadius: '4px' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div style={terminalStyle}>
          <div style={{ color: '#64748B', marginBottom: '8px' }}>LIVE TRAFFIC LOG</div>
          <div>[10:14:02] POST /api/v1/sync - 200 OK - 42ms</div>
          <div>[10:14:03] GET /api/v1/inventory - 200 OK - 18ms</div>
          <div>[10:14:05] POST /api/v1/orders - 201 CREATED - 105ms</div>
          <div>[10:14:05] GET /api/v1/audit/logs - 200 OK - 22ms</div>
        </div>
      </div>
    </div>
  );
};
