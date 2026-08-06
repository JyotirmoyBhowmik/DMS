import React from 'react';
import type { UserRole, PlatformNode } from '../../types';
import { useData } from '../../context/DataContext';
import { tokens } from '../../theme/tokens';

export const PlatformMatrix: React.FC<{ role: UserRole }> = ({ role: _role }) => {
  const { platformNodes } = useData();

  const onlineCount = platformNodes.filter((n: PlatformNode) => n.status === 'online' || n.status === 'HEALTHY').length;

  return (
    <div style={{ padding: '24px', backgroundColor: tokens.colors.bgApp, minHeight: '100vh', color: tokens.colors.textBody }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: tokens.colors.textMain }}>Platform Matrix</h1>
        <div style={{
          backgroundColor: onlineCount === platformNodes.length ? tokens.colors.successBg : tokens.colors.warningBg,
          color: onlineCount === platformNodes.length ? tokens.colors.success : tokens.colors.warning,
          padding: '4px 12px', borderRadius: '16px', fontSize: '14px', fontWeight: 600,
        }}>
          {onlineCount}/{platformNodes.length} NODES ONLINE
        </div>
      </div>

      {platformNodes.length === 0 ? (
        <div style={{ backgroundColor: '#FFFFFF', padding: '24px', borderRadius: '8px', border: `1px solid ${tokens.colors.border}` }}>
          <p style={{ color: tokens.colors.textMuted, fontSize: '14px', margin: 0 }}>No microservice platform nodes registered in database.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
          {platformNodes.map((node: PlatformNode) => {
            const isHealthy = node.status === 'online' || node.status === 'HEALTHY';
            return (
              <div key={node.name} style={{
                backgroundColor: '#FFFFFF', padding: '20px', borderRadius: '8px',
                border: `1px solid ${tokens.colors.border}`, boxShadow: tokens.shadows.sm,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '16px', color: tokens.colors.textMain }}>{node.name}</span>
                  <span style={{
                    backgroundColor: tokens.colors.infoBg, color: tokens.colors.info,
                    padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 500,
                  }}>{node.category}</span>
                </div>
                <p style={{ color: tokens.colors.textMuted, fontSize: '14px', marginBottom: '16px', margin: 0 }}>{node.details}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                  <div style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    backgroundColor: isHealthy ? tokens.colors.success : tokens.colors.danger,
                  }} />
                  <span style={{ fontWeight: 500 }}>{node.latency.endsWith('ms') ? node.latency : `${node.latency}ms`} latency</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
