import React from 'react';
import { UserRole, SyncTask } from '../../types';
import { useData } from '../../context/DataContext';
import { StatusBadge } from '../../components/StatusBadge';
import { tokens } from '../../theme/tokens';

export const SyncQueue: React.FC<{ role: UserRole }> = () => {
  const { syncQueue } = useData();
  const [items, setItems] = React.useState(syncQueue);
  const [selectedError, setSelectedError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setItems(syncQueue);
  }, [syncQueue]);

  // ⚡ Bolt: Single-pass O(n) array traversal with useMemo
  // Expected impact: Reduces CPU cycles and memory allocations by turning three O(N) array filter passes on every render into a single O(N) pass only when items change.
  const { totalSynced, processing, failed } = React.useMemo(() => {
    return items.reduce(
      (acc, item: SyncTask) => {
        if (item.status === 'SYNCHRONIZED') acc.totalSynced++;
        else if (item.status === 'PROCESSING') acc.processing++;
        else if (item.status === 'FAILED') acc.failed++;
        return acc;
      },
      { totalSynced: 0, processing: 0, failed: 0 },
    );
  }, [items]);

  const handleRetryTask = (id: string) => {
    setItems((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, status: 'SYNCHRONIZED', latency: '24ms (Retried)' } : t,
      ),
    );
  };

  const handleReconcileAll = () => {
    setItems((prev) =>
      prev.map((t) =>
        t.status === 'FAILED' ? { ...t, status: 'SYNCHRONIZED', latency: '40ms (Reconciled)' } : t,
      ),
    );
  };

  return (
    <div
      style={{
        padding: '24px',
        backgroundColor: tokens.colors.bgApp,
        minHeight: '100vh',
        color: tokens.colors.textBody,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '24px',
              fontWeight: 'bold',
              color: tokens.colors.textMain,
              margin: 0,
            }}
          >
            ERP Integration & Reconciliation Ops Board
          </h1>
          <p style={{ color: tokens.colors.textMuted, margin: '4px 0 0', fontSize: '14px' }}>
            Real-time ERP connector execution logs, field translation errors, and manual ops
            reconciliation ({items.length} items)
          </p>
        </div>
        {failed > 0 && (
          <button
            onClick={handleReconcileAll}
            style={{
              background: '#15803D',
              color: '#FFF',
              border: 'none',
              borderRadius: '6px',
              padding: '10px 16px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reconcile All Failed Items ({failed})
          </button>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '20px',
          marginBottom: '24px',
        }}
      >
        <div
          style={{
            backgroundColor: '#FFFFFF',
            padding: '20px',
            borderRadius: '8px',
            border: `1px solid ${tokens.colors.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <div>
            <div style={{ fontSize: '14px', color: tokens.colors.textMuted, marginBottom: '4px' }}>
              Total Synced / Reconciled
            </div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: tokens.colors.success }}>
              {totalSynced}
            </div>
          </div>
        </div>
        <div
          style={{
            backgroundColor: '#FFFFFF',
            padding: '20px',
            borderRadius: '8px',
            border: `1px solid ${tokens.colors.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <div>
            <div style={{ fontSize: '14px', color: tokens.colors.textMuted, marginBottom: '4px' }}>
              Processing Jobs
            </div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: tokens.colors.info }}>
              {processing}
            </div>
          </div>
        </div>
        <div
          style={{
            backgroundColor: '#FFFFFF',
            padding: '20px',
            borderRadius: '8px',
            border: `1px solid ${tokens.colors.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <div>
            <div style={{ fontSize: '14px', color: tokens.colors.textMuted, marginBottom: '4px' }}>
              Failed / Pending Ops Review
            </div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: tokens.colors.danger }}>
              {failed}
            </div>
          </div>
        </div>
      </div>

      {selectedError && (
        <div
          style={{
            background: '#FEF2F2',
            border: '1px solid #FCA5A5',
            color: '#991B1B',
            padding: '16px',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '13px',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: '4px' }}>
            Ops Inspection Error Traceback:
          </div>
          <code>{selectedError}</code>
          <button
            onClick={() => setSelectedError(null)}
            style={{
              display: 'block',
              marginTop: '10px',
              background: '#991B1B',
              color: '#FFF',
              border: 'none',
              padding: '4px 8px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            Dismiss Traceback
          </button>
        </div>
      )}

      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '8px',
          border: `1px solid ${tokens.colors.border}`,
          overflow: 'hidden',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr
              style={{
                backgroundColor: '#F8FAFC',
                borderBottom: `1px solid ${tokens.colors.border}`,
              }}
            >
              <th
                style={{
                  padding: '12px 16px',
                  fontWeight: 600,
                  color: tokens.colors.textBody,
                  fontSize: '13px',
                }}
              >
                Sync Task ID
              </th>
              <th
                style={{
                  padding: '12px 16px',
                  fontWeight: 600,
                  color: tokens.colors.textBody,
                  fontSize: '13px',
                }}
              >
                Connector Type
              </th>
              <th
                style={{
                  padding: '12px 16px',
                  fontWeight: 600,
                  color: tokens.colors.textBody,
                  fontSize: '13px',
                }}
              >
                Event Payload / Action
              </th>
              <th
                style={{
                  padding: '12px 16px',
                  fontWeight: 600,
                  color: tokens.colors.textBody,
                  fontSize: '13px',
                }}
              >
                Status
              </th>
              <th
                style={{
                  padding: '12px 16px',
                  fontWeight: 600,
                  color: tokens.colors.textBody,
                  fontSize: '13px',
                }}
              >
                Latency
              </th>
              <th
                style={{
                  padding: '12px 16px',
                  fontWeight: 600,
                  color: tokens.colors.textBody,
                  fontSize: '13px',
                }}
              >
                Ops Action
              </th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  style={{
                    padding: '24px',
                    textAlign: 'center',
                    color: tokens.colors.textMuted,
                    fontSize: '14px',
                  }}
                >
                  No integration sync tasks recorded in database
                </td>
              </tr>
            ) : (
              items.map((task: SyncTask, idx: number) => (
                <tr
                  key={task.id}
                  style={{
                    borderBottom:
                      idx === items.length - 1 ? 'none' : `1px solid ${tokens.colors.border}`,
                  }}
                >
                  <td style={{ padding: '12px 16px', fontWeight: 600, fontFamily: 'monospace' }}>
                    {task.id}
                  </td>
                  <td
                    style={{ padding: '12px 16px', fontWeight: 600, color: tokens.colors.textMain }}
                  >
                    {task.source}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <code
                      style={{
                        backgroundColor: tokens.colors.bgSubtle,
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        color: tokens.colors.brand,
                      }}
                    >
                      {task.event}
                    </code>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <StatusBadge status={task.status} />
                  </td>
                  <td
                    style={{
                      padding: '12px 16px',
                      color: tokens.colors.textMuted,
                      fontSize: '13px',
                    }}
                  >
                    {task.latency}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {task.status === 'FAILED' ? (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => handleRetryTask(task.id)}
                          style={{
                            background: '#2563EB',
                            color: '#FFF',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '4px 10px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Retry Job
                        </button>
                        <button
                          onClick={() =>
                            setSelectedError(
                              `[ERP_FIELD_MISMATCH] Field 'RATE' in Tally XML payload missing required decimal precision on line 14.`,
                            )
                          }
                          style={{
                            background: '#DC2626',
                            color: '#FFF',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '4px 10px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Inspect Error
                        </button>
                      </div>
                    ) : (
                      <span style={{ color: '#166534', fontSize: '12px', fontWeight: 600 }}>
                        ✓ Verified
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
