import React from 'react';
import { UserRole, SyncTask } from '../../types';
import { useData } from '../../context/DataContext';
import { StatusBadge } from '../../components/StatusBadge';
import { tokens } from '../../theme/tokens';

export const SyncQueue: React.FC<{ role: UserRole }> = () => {
  const { syncQueue } = useData();

  const totalSynced = syncQueue.filter((q: SyncTask) => q.status === 'SYNCHRONIZED').length;
  const processing = syncQueue.filter((q: SyncTask) => q.status === 'PROCESSING').length;
  const failed = syncQueue.filter((q: SyncTask) => q.status === 'FAILED').length;

  return (
    <div style={{ padding: '24px', backgroundColor: tokens.colors.bgApp, minHeight: '100vh', color: tokens.colors.textBody }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: tokens.colors.textMain, margin: 0 }}>Integration Sync Queue</h1>
          <p style={{ color: tokens.colors.textMuted, margin: '4px 0 0', fontSize: '14px' }}>
            Real-time ERP & offline mobile sync transaction log ({syncQueue.length} items)
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        <div style={{ backgroundColor: '#FFFFFF', padding: '20px', borderRadius: '8px', border: `1px solid ${tokens.colors.border}`, display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '14px', color: tokens.colors.textMuted, marginBottom: '4px' }}>Total Synced</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: tokens.colors.success }}>{totalSynced}</div>
          </div>
        </div>
        <div style={{ backgroundColor: '#FFFFFF', padding: '20px', borderRadius: '8px', border: `1px solid ${tokens.colors.border}`, display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '14px', color: tokens.colors.textMuted, marginBottom: '4px' }}>Processing</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: tokens.colors.info }}>{processing}</div>
          </div>
        </div>
        <div style={{ backgroundColor: '#FFFFFF', padding: '20px', borderRadius: '8px', border: `1px solid ${tokens.colors.border}`, display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '14px', color: tokens.colors.textMuted, marginBottom: '4px' }}>Failed / Pending Retries</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: tokens.colors.danger }}>{failed}</div>
          </div>
        </div>
      </div>

      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '8px', border: `1px solid ${tokens.colors.border}`, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: `1px solid ${tokens.colors.border}` }}>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: tokens.colors.textBody, fontSize: '13px' }}>Sync Task ID</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: tokens.colors.textBody, fontSize: '13px' }}>Source Platform</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: tokens.colors.textBody, fontSize: '13px' }}>Event Payload</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: tokens.colors.textBody, fontSize: '13px' }}>Status</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: tokens.colors.textBody, fontSize: '13px' }}>Sync Latency</th>
            </tr>
          </thead>
          <tbody>
            {syncQueue.map((task: SyncTask, idx: number) => (
              <tr key={task.id} style={{ borderBottom: idx === syncQueue.length - 1 ? 'none' : `1px solid ${tokens.colors.border}` }}>
                <td style={{ padding: '12px 16px', fontWeight: 600, fontFamily: 'monospace' }}>{task.id}</td>
                <td style={{ padding: '12px 16px', fontWeight: 600, color: tokens.colors.textMain }}>{task.source}</td>
                <td style={{ padding: '12px 16px' }}>
                  <code style={{ backgroundColor: tokens.colors.bgSubtle, padding: '3px 8px', borderRadius: '4px', fontSize: '12px', color: tokens.colors.brand }}>
                    {task.event}
                  </code>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <StatusBadge status={task.status} />
                </td>
                <td style={{ padding: '12px 16px', color: tokens.colors.textMuted, fontSize: '13px' }}>{task.latency}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
