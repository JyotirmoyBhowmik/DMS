import React, { useState } from 'react';
import { Modal } from '../Modal';
import { FormField } from '../FormField';
import type { UserRole } from '../../types';
import { tokens } from '../../theme/tokens';

interface UserCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (user: { email: string; roles: UserRole }) => void;
}

export const UserCreateModal: React.FC<UserCreateModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('agent');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    onSubmit({ email, roles: role });
    setEmail('');
    onClose();
  };

  return (
    <Modal title="Add Platform User" subtitle="Provision user access & assign RBAC role" isOpen={isOpen} onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <FormField label="Email Address">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@enterprise.com"
            style={tokens.presets.input}
            required
          />
        </FormField>

        <FormField label="Assigned RBAC Role">
          <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} style={tokens.presets.input}>
            <option value="admin">👑 Admin — Full platform access</option>
            <option value="agent">📍 Agent — Field sales & SFA access</option>
            <option value="distributor">📦 Distributor — Stock & order access</option>
            <option value="auditor">🛡️ Auditor — Read-only compliance view</option>
          </select>
        </FormField>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
          <button type="button" onClick={onClose} style={tokens.presets.buttonSecondary}>Cancel</button>
          <button type="submit" style={tokens.presets.buttonPrimary}>Provision User</button>
        </div>
      </form>
    </Modal>
  );
};
