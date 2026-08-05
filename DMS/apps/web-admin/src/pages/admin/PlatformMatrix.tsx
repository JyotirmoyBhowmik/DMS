import React, { useState, useEffect } from 'react';
import type { UserRole, PlatformNode } from '../../types';
import { dbService } from '../../services/dbService';

export const PlatformMatrix: React.FC<{ role: UserRole }> = ({ role: _role }) => {
  const [nodes, setNodes] = useState<PlatformNode[]>([]);

  useEffect(() => {
    dbService.getPlatformNodes().then(setNodes);
  }, []);

  const containerStyle: React.CSSProperties = { padding: '24px', backgroundColor: '#F8FAFC', minHeight: '100vh', color: '#334155' };
  const headerContainerStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' };
  const headerStyle: React.CSSProperties = { fontSize: '24px', fontWeight: 'bold', color: '#0F172A' };
  const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' };
  const cardStyle: React.CSSProperties = { backgroundColor: '#FFFFFF', padding: '20px', borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' };
  const nodeNameStyle: React.CSSProperties = { fontFamily: 'monospace', fontWeight: 600, fontSize: '16px', color: '#0F172A' };
  const badgeStyle: React.CSSProperties = { backgroundColor: '#E0E7FF', color: '#4338CA', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 500 };
  const statusBadgeStyle: React.CSSProperties = { backgroundColor: '#DCFCE7', color: '#15803D', padding: '4px 12px', borderRadius: '16px', fontSize: '14px', fontWeight: 600 };

  return (
    <div style={containerStyle}>
      <div style={headerContainerStyle}>
        <h1 style={headerStyle}>Platform Matrix</h1>
        <div style={statusBadgeStyle}>{nodes.length}/{nodes.length} NODES ONLINE</div>
      </div>
      
      <div style={gridStyle}>
        {nodes.map((node: PlatformNode) => (
          <div key={node.name} style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={nodeNameStyle}>{node.name}</span>
              <span style={badgeStyle}>{node.category}</span>
            </div>
            <p style={{ color: '#64748B', fontSize: '14px', marginBottom: '16px', margin: 0 }}>{node.details}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: node.status === 'online' || node.status === 'HEALTHY' ? '#15803D' : '#B91C1C' }} />
              <span style={{ fontWeight: 500 }}>{node.latency.endsWith('ms') ? node.latency : `${node.latency}ms`} latency</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
