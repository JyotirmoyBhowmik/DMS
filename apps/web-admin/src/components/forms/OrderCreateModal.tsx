import React, { useState } from 'react';
import { Modal } from '../Modal';
import { FormField } from '../FormField';
import { AGENT_NAMES } from '../../data/seed';
import { useData } from '../../context/DataContext';
import { tokens } from '../../theme/tokens';

interface OrderCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (order: { outlet: string; agent: string; totalAmount: string; items: number }) => void;
}

export const OrderCreateModal: React.FC<OrderCreateModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const { outlets } = useData();
  const [outlet, setOutlet] = useState(outlets[0]?.name || 'City Supermarket');
  const [agent, setAgent] = useState(AGENT_NAMES[0]);
  const [amount, setAmount] = useState('1250.00');
  const [items, setItems] = useState('12');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount) || 0;
    onSubmit({
      outlet,
      agent,
      totalAmount: `$${numAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      items: parseInt(items, 10) || 1,
    });
    onClose();
  };

  return (
    <Modal title="Create Field Sales Order" subtitle="Submit new order from field sales rep" isOpen={isOpen} onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <FormField label="Retail Outlet">
          <select value={outlet} onChange={(e) => setOutlet(e.target.value)} style={tokens.presets.input}>
            {outlets.map((o) => (
              <option key={o.id} value={o.name}>{o.name} ({o.type})</option>
            ))}
          </select>
        </FormField>

        <FormField label="Field Representative">
          <select value={agent} onChange={(e) => setAgent(e.target.value)} style={tokens.presets.input}>
            {AGENT_NAMES.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </FormField>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <FormField label="Order Amount ($)">
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={tokens.presets.input}
              required
            />
          </FormField>

          <FormField label="Item Quantity">
            <input
              type="number"
              value={items}
              onChange={(e) => setItems(e.target.value)}
              style={tokens.presets.input}
              required
            />
          </FormField>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
          <button type="button" onClick={onClose} style={tokens.presets.buttonSecondary}>Cancel</button>
          <button type="submit" style={tokens.presets.buttonPrimary}>Submit Order</button>
        </div>
      </form>
    </Modal>
  );
};
