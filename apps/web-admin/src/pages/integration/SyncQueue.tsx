import React from 'react';
import { UserRole } from '../../types';
import { SEED_SYNC_QUEUE } from '../../data/seed';
import { StatusBadge } from '../../components/StatusBadge';

export const SyncQueue: React.FC<{ role: UserRole }> = () => {
  const totalSynced = SEED_SYNC_QUEUE.filter(q => q.status === 'SYNCHRONIZED').length;
  const processing = SEED_SYNC_QUEUE.filter(q => q.status === 'PROCESSING').length;
  const failed = SEED_SYNC_QUEUE.filter(q => q.status === 'FAILED').length;

  return (
    <div style={{ padding: '24px', backgroundColor: '#F8FAFC', minHeight: '100vh', color: '#334155', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ margin: '0 0 24px 0', color: '#0F172A', fontSize: '24px', fontWeight: 'bold' }}>Integration Sync Queue</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        <div style={{ backgroundColor: '#FFFFFF', padding: '20px', borderRadius: '8px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '16px' }}>
           <div>
            <div style={{ fontSize: '14px', color: '#64748B', marginBottom: '4px' }}>Total Synced</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#15803D' }}>{totalSynced}</div>
           </div>
        </div>
        <div style={{ backgroundColor: '#FFFFFF', padding: '20px', borderRadius: '8px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '16px' }}>
           <div>
            <div style={{ fontSize: '14px', color: '#64748B', marginBottom: '4px' }}>Processing</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2563EB' }}>{processing}</div>
           </div>
        </div>
        <div style={{ backgroundColor: '#FFFFFF', padding: '20px', borderRadius: '8px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '16px' }}>
           <div>
            <div style={{ fontSize: '14px', color: '#64748B', marginBottom: '4px' }}>Failed</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#B91C1C' }}>{failed}</div>
           </div>
        </div>
      </div>

      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              <th style={{ padding: '12px 16px', fontWeight: 500, color: '#64748B' }}>Sync Task ID</th>
              <th style={{ padding: '12px 16px', fontWeight: 500, color: '#64748B' }}>Source Platform</th>
              <th style={{ padding: '12px 16px', fontWeight: 500, color: '#64748B' }}>Event Payload</th>
              <th style={{ padding: '12px 16px', fontWeight: 500, color: '#64748B' }}>Status</th>
              <th style={{ padding: '12px 16px', fontWeight: 500, color: '#64748B' }}>Sync Latency</th>
            </tr>
          </thead>
          <tbody>
            {SEED_SYNC_QUEUE.map((task, idx) => (
              <tr key={task.id} style={{ borderBottom: idx === SEED_SYNC_QUEUE.length - 1 ? 'none' : '1px solid #E2E8F0' }}>
                <td style={{ padding: '12px 16px', fontWeight: 500 }}>{task.id}</td>
                <td style={{ padding: '12px 16px' }}>{task.source}</td>
                <td style={{ padding: '12px 16px' }}>
                  <code style={{ backgroundColor: '#F1F5F9', padding: '2px 6px', borderRadius: '4px', fontSize: '12px', color: '#334155' }}>
                    {task.event}
                  </code>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <StatusBadge status={task.status} />
                </td>
                <td style={{ padding: '12px 16px' }}>{task.latency}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
