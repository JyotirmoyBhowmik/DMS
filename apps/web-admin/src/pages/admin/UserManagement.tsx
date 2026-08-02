import React, { useState } from 'react';
import type { UserRole } from '../../types';
import { useData } from '../../context/DataContext';
import { StatusBadge } from '../../components/StatusBadge';
import { UserCreateModal } from '../../components/forms/UserCreateModal';
import { tokens } from '../../theme/tokens';

export const UserManagement: React.FC<{ role: UserRole }> = ({ role }) => {
  const { users, addUser } = useData();
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'roles' | 'permissions'>('users');
  const [showAddModal, setShowAddModal] = useState(false);

  const isAuditor = role === 'auditor';

  return (
    <div style={{ padding: '24px', backgroundColor: tokens.colors.bgApp, minHeight: '100vh', color: tokens.colors.textBody }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: tokens.colors.textMain, margin: 0 }}>
            User & Role Management
          </h1>
          <p style={{ color: tokens.colors.textMuted, margin: '4px 0 0', fontSize: '14px' }}>
            Managed DB users, RBAC roles, and tenant context
          </p>
        </div>
        {!isAuditor && (
          <button style={tokens.presets.buttonPrimary} onClick={() => setShowAddModal(true)}>
            + Add New User
          </button>
        )}
      </div>

      <div style={{ display: 'flex', borderBottom: `1px solid ${tokens.colors.border}`, marginBottom: '24px' }}>
        <div
          onClick={() => setActiveSubTab('users')}
          style={{
            padding: '12px 24px',
            cursor: 'pointer',
            fontWeight: activeSubTab === 'users' ? 600 : 400,
            color: activeSubTab === 'users' ? tokens.colors.brand : tokens.colors.textMuted,
            borderBottom: activeSubTab === 'users' ? `2px solid ${tokens.colors.brand}` : 'none',
          }}
        >
          Users ({users.length})
        </div>
        <div
          onClick={() => setActiveSubTab('roles')}
          style={{
            padding: '12px 24px',
            cursor: 'pointer',
            fontWeight: activeSubTab === 'roles' ? 600 : 400,
            color: activeSubTab === 'roles' ? tokens.colors.brand : tokens.colors.textMuted,
            borderBottom: activeSubTab === 'roles' ? `2px solid ${tokens.colors.brand}` : 'none',
          }}
        >
          Roles
        </div>
        <div
          onClick={() => setActiveSubTab('permissions')}
          style={{
            padding: '12px 24px',
            cursor: 'pointer',
            fontWeight: activeSubTab === 'permissions' ? 600 : 400,
            color: activeSubTab === 'permissions' ? tokens.colors.brand : tokens.colors.textMuted,
            borderBottom: activeSubTab === 'permissions' ? `2px solid ${tokens.colors.brand}` : 'none',
          }}
        >
          Permissions
        </div>
      </div>

      {activeSubTab === 'users' && (
        <div style={{ backgroundColor: '#FFFFFF', border: `1px solid ${tokens.colors.border}`, borderRadius: '8px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: `1px solid ${tokens.colors.border}` }}>
                <th style={{ padding: '14px 16px', color: tokens.colors.textBody, fontWeight: 600, fontSize: '13px' }}>User ID</th>
                <th style={{ padding: '14px 16px', color: tokens.colors.textBody, fontWeight: 600, fontSize: '13px' }}>Email Address</th>
                <th style={{ padding: '14px 16px', color: tokens.colors.textBody, fontWeight: 600, fontSize: '13px' }}>Role</th>
                <th style={{ padding: '14px 16px', color: tokens.colors.textBody, fontWeight: 600, fontSize: '13px' }}>Status</th>
                <th style={{ padding: '14px 16px', color: tokens.colors.textBody, fontWeight: 600, fontSize: '13px' }}>Last Login</th>
                {!isAuditor && <th style={{ padding: '14px 16px', color: tokens.colors.textBody, fontWeight: 600, fontSize: '13px' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderBottom: `1px solid ${tokens.colors.border}` }}>
                  <td style={{ padding: '14px 16px', fontFamily: 'monospace' }}>{u.id}</td>
                  <td style={{ padding: '14px 16px', fontWeight: 600, color: tokens.colors.textMain }}>{u.email}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ backgroundColor: tokens.colors.infoBg, color: tokens.colors.info, padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>
                      {u.roles}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px' }}><StatusBadge status={u.status} /></td>
                  <td style={{ padding: '14px 16px', color: tokens.colors.textMuted }}>{u.lastLogin}</td>
                  {!isAuditor && (
                    <td style={{ padding: '14px 16px' }}>
                      <button style={{ padding: '6px 12px', borderRadius: '4px', border: `1px solid ${tokens.colors.border}`, backgroundColor: '#FFFFFF', cursor: 'pointer', fontSize: '12px' }}>
                        Edit
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <UserCreateModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={(userData) => addUser(userData)}
      />
    </div>
  );
};
