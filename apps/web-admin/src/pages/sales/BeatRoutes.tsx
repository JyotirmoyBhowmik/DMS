import React, { useState } from 'react';
import type { UserRole } from '../../types';
import { useData } from '../../context/DataContext';
import { StatusBadge } from '../../components/StatusBadge';
import { AGENT_NAMES, GEOFENCE_RADII } from '../../data/seed';
import { Modal } from '../../components/Modal';
import { FormField } from '../../components/FormField';
import { tokens } from '../../theme/tokens';

export const BeatRoutes: React.FC<{ role: UserRole }> = ({ role }) => {
  const { beatRoutes, addBeatRoute } = useData();
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [agent, setAgent] = useState(AGENT_NAMES[0]);
  const [radiusKm, setRadiusKm] = useState(GEOFENCE_RADII[1]);

  const canCreate = role === 'admin';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    addBeatRoute({
      name,
      agent,
      radiusKm,
    });
    setName('');
    setShowModal(false);
  };

  return (
    <div style={{ padding: '24px', backgroundColor: tokens.colors.bgApp, minHeight: '100vh', color: tokens.colors.textBody }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: tokens.colors.textMain, margin: 0 }}>Beat & Route Planning</h1>
          <p style={{ color: tokens.colors.textMuted, margin: '4px 0 0', fontSize: '14px' }}>
            Territory beat assignment & GPS geofenced radius validation
          </p>
        </div>

        {canCreate && (
          <button style={tokens.presets.buttonPrimary} onClick={() => setShowModal(true)}>
            + Create Beat Route
          </button>
        )}
      </div>

      <div style={{ backgroundColor: '#FFFFFF', border: `1px solid ${tokens.colors.border}`, borderRadius: '8px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: `1px solid ${tokens.colors.border}` }}>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: tokens.colors.textBody, fontSize: '13px' }}>Beat Code</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: tokens.colors.textBody, fontSize: '13px' }}>Route Name</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: tokens.colors.textBody, fontSize: '13px' }}>Assigned Field Rep</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: tokens.colors.textBody, fontSize: '13px' }}>Outlets Covered</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: tokens.colors.textBody, fontSize: '13px' }}>Geofence Radius</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: tokens.colors.textBody, fontSize: '13px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {beatRoutes.map((b, idx) => (
              <tr key={b.id} style={{ borderBottom: idx === beatRoutes.length - 1 ? 'none' : `1px solid ${tokens.colors.border}` }}>
                <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 600 }}>{b.code}</td>
                <td style={{ padding: '12px 16px', fontWeight: 600, color: tokens.colors.textMain }}>{b.name}</td>
                <td style={{ padding: '12px 16px', color: tokens.colors.textMuted }}>{b.agent}</td>
                <td style={{ padding: '12px 16px', fontWeight: 600 }}>{b.outletsCount} stores</td>
                <td style={{ padding: '12px 16px', color: tokens.colors.brand }}>{b.radiusKm}</td>
                <td style={{ padding: '12px 16px' }}><StatusBadge status={b.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal title="Create Beat Route" subtitle="Define territory beat & assign field representative" isOpen={showModal} onClose={() => setShowModal(false)}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <FormField label="Route Name">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Westside Commercial Loop"
              style={tokens.presets.input}
              required
            />
          </FormField>

          <FormField label="Assigned Field Representative">
            <select value={agent} onChange={(e) => setAgent(e.target.value)} style={tokens.presets.input}>
              {AGENT_NAMES.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Geofence Validation Radius">
            <select value={radiusKm} onChange={(e) => setRadiusKm(e.target.value)} style={tokens.presets.input}>
              {GEOFENCE_RADII.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </FormField>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
            <button type="button" onClick={() => setShowModal(false)} style={tokens.presets.buttonSecondary}>Cancel</button>
            <button type="submit" style={tokens.presets.buttonPrimary}>Save Beat Route</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
