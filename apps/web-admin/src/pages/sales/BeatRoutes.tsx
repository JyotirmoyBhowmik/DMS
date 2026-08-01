import React, { useState, useEffect } from 'react';
import { UserRole, BeatRoute } from '../../types';
import { AGENT_NAMES, GEOFENCE_RADII } from '../../data/seed';
import { dbService } from '../../services/dbService';
import { StatusBadge } from '../../components/StatusBadge';

export const BeatRoutes: React.FC<{ role: UserRole }> = ({ role }) => {
  const [beats, setBeats] = useState<BeatRoute[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const myAgentName = "Agent Sarah Jenkins";

  useEffect(() => {
    dbService.getBeatRoutes().then(setBeats);
  }, []);

  const visibleRoutes = role === 'agent' 
    ? beats.filter((r: BeatRoute) => r.agent === myAgentName)
    : beats;

  return (
    <div style={{ padding: '24px', backgroundColor: '#F8FAFC', minHeight: '100vh', color: '#334155' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#0F172A', margin: 0 }}>Beat Routes</h1>
        {role === 'admin' && (
          <button 
            onClick={() => setIsModalOpen(true)}
            style={{ padding: '8px 16px', backgroundColor: '#2563EB', color: '#FFFFFF', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            + Create Beat Route
          </button>
        )}
      </div>

      <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
            <tr>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Beat Code</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Route Name</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Assigned Agent</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Outlets Covered</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Geofence Radius</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {visibleRoutes.map((r: BeatRoute) => (
              <tr key={r.id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                <td style={{ padding: '12px 16px' }}>{r.code}</td>
                <td style={{ padding: '12px 16px' }}>{r.name}</td>
                <td style={{ padding: '12px 16px' }}>{r.agent}</td>
                <td style={{ padding: '12px 16px' }}>{r.outletsCount}</td>
                <td style={{ padding: '12px 16px' }}>{r.radiusKm}</td>
                <td style={{ padding: '12px 16px' }}><StatusBadge status={r.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ backgroundColor: '#FFFFFF', padding: '24px', borderRadius: '8px', width: '400px' }}>
            <h2 style={{ margin: '0 0 16px 0', color: '#0F172A' }}>Create Beat Route</h2>
            <form onSubmit={e => { e.preventDefault(); setIsModalOpen(false); }} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input type="text" placeholder="Route Name" required style={{ padding: '8px', border: '1px solid #E2E8F0', borderRadius: '4px' }} />
              <select style={{ padding: '8px', border: '1px solid #E2E8F0', borderRadius: '4px' }}>
                {AGENT_NAMES?.map((a: string) => <option key={a} value={a}>{a}</option>)}
              </select>
              <select style={{ padding: '8px', border: '1px solid #E2E8F0', borderRadius: '4px' }}>
                {GEOFENCE_RADII?.map((g: string) => <option key={g} value={g}>{g}</option>)}
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
