import React, { useState } from 'react';
import { UserRole } from '../../types';
import { SEED_OUTLETS, OUTLET_TYPES, AGENT_NAMES } from '../../data/seed';
import { StatusBadge } from '../../components/StatusBadge';

export const OutletRegistry: React.FC<{ role: UserRole }> = ({ role }) => {
  const [outlets, setOutlets] = useState(SEED_OUTLETS);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const myAgentName = "Agent One"; // Example

  const visibleOutlets = role === 'agent' 
    ? outlets.filter((o: any) => o.assignedAgent === myAgentName)
    : outlets;

  return (
    <div style={{ padding: '24px', backgroundColor: '#F8FAFC', minHeight: '100vh', color: '#334155' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#0F172A', margin: 0 }}>Outlet Registry</h1>
        {role === 'admin' && (
          <button 
            onClick={() => setIsModalOpen(true)}
            style={{ padding: '8px 16px', backgroundColor: '#2563EB', color: '#FFFFFF', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            + Register Outlet
          </button>
        )}
      </div>

      <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
            <tr>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Outlet Name</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Type</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Address</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Credit Limit</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Assigned Agent</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {visibleOutlets.map((o: any) => (
              <tr key={o.id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                <td style={{ padding: '12px 16px', fontWeight: '500' }}>{o.name}</td>
                <td style={{ padding: '12px 16px' }}><StatusBadge status={o.type} /></td>
                <td style={{ padding: '12px 16px' }}>{o.address}</td>
                <td style={{ padding: '12px 16px' }}>${o.creditLimit}</td>
                <td style={{ padding: '12px 16px' }}>{o.assignedAgent}</td>
                <td style={{ padding: '12px 16px' }}><StatusBadge status={o.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ backgroundColor: '#FFFFFF', padding: '24px', borderRadius: '8px', width: '400px' }}>
            <h2 style={{ margin: '0 0 16px 0', color: '#0F172A' }}>Register Outlet</h2>
            <form onSubmit={e => { e.preventDefault(); setIsModalOpen(false); }} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input type="text" placeholder="Outlet Name" required style={{ padding: '8px', border: '1px solid #E2E8F0', borderRadius: '4px' }} />
              <select style={{ padding: '8px', border: '1px solid #E2E8F0', borderRadius: '4px' }}>
                {OUTLET_TYPES?.map((t: string) => <option key={t} value={t}>{t}</option>)}
              </select>
              <input type="text" placeholder="Address" required style={{ padding: '8px', border: '1px solid #E2E8F0', borderRadius: '4px' }} />
              <input type="number" placeholder="Credit Limit" required style={{ padding: '8px', border: '1px solid #E2E8F0', borderRadius: '4px' }} />
              <select style={{ padding: '8px', border: '1px solid #E2E8F0', borderRadius: '4px' }}>
                {AGENT_NAMES?.map((a: string) => <option key={a} value={a}>{a}</option>)}
              </select>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '8px 16px', border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '8px 16px', backgroundColor: '#2563EB', color: '#FFFFFF', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
