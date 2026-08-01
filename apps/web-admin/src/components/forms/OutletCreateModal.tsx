import React, { useState } from 'react';
import { Modal } from '../Modal';
import { FormField } from '../FormField';
import { OUTLET_TYPES, AGENT_NAMES } from '../../data/seed';
import type { Outlet } from '../../types';
import { tokens } from '../../theme/tokens';

interface OutletCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (outlet: Omit<Outlet, 'id' | 'status'>) => void;
}

export const OutletCreateModal: React.FC<OutletCreateModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<Outlet['type']>(OUTLET_TYPES[0]);
  const [address, setAddress] = useState('');
  const [creditLimit, setCreditLimit] = useState('25000');
  const [assignedAgent, setAssignedAgent] = useState(AGENT_NAMES[0]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name,
      type,
      address,
      creditLimit: parseFloat(creditLimit) || 10000,
      assignedAgent,
    });
    setName('');
    setAddress('');
    onClose();
  };

  return (
    <Modal title="Register Retail Outlet" subtitle="Onboard store & establish credit line" isOpen={isOpen} onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <FormField label="Outlet Name">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Apex Supermarket"
            style={tokens.presets.input}
            required
          />
        </FormField>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <FormField label="Store Type">
            <select value={type} onChange={(e) => setType(e.target.value as Outlet['type'])} style={tokens.presets.input}>
              {OUTLET_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Assigned Sales Rep">
            <select value={assignedAgent} onChange={(e) => setAssignedAgent(e.target.value)} style={tokens.presets.input}>
              {AGENT_NAMES.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </FormField>
        </div>

        <FormField label="Address / Territory Zone">
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="12 Market St, Zone A"
            style={tokens.presets.input}
            required
          />
        </FormField>

        <FormField label="Credit Limit ($)">
          <input
            type="number"
            value={creditLimit}
            onChange={(e) => setCreditLimit(e.target.value)}
            style={tokens.presets.input}
            required
          />
        </FormField>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
          <button type="button" onClick={onClose} style={tokens.presets.buttonSecondary}>Cancel</button>
          <button type="submit" style={tokens.presets.buttonPrimary}>Register Outlet</button>
        </div>
      </form>
    </Modal>
  );
};
