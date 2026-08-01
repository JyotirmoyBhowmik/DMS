import React, { useState, useEffect } from 'react';
import type { UserRole, AppUser } from '../../types';
import { dbService } from '../../services/dbService';
import { StatusBadge } from '../../components/StatusBadge';

export const UserManagement: React.FC<{ role: UserRole }> = ({ role }) => {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'roles' | 'tenants' | 'permissions' | 'mfa'>('users');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('agent');

  useEffect(() => {
    dbService.getUsers().then((data) => {
      setUsers(data);
      setLoading(false);
    });
  }, []);

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail) return;
    const newUser: AppUser = {
      id: `usr-${Date.now()}`,
      email: newEmail,
      status: 'ACTIVE',
      roles: newRole,
      lastLogin: 'Never',
    };
    setUsers([...users, newUser]);
    setNewEmail('');
    setShowAddModal(false);
  };

  const isAuditor = role === 'auditor';

  const containerStyle: React.CSSProperties = { padding: '24px', backgroundColor: '#F8FAFC', minHeight: '100vh', color: '#334155' };
  const headerContainerStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' };
  const headerStyle: React.CSSProperties = { fontSize: '24px', fontWeight: 'bold', color: '#0F172A' };
  const buttonStyle: React.CSSProperties = { backgroundColor: '#0F172A', color: '#FFFFFF', padding: '10px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 600 };
  const tabContainerStyle: React.CSSProperties = { display: 'flex', borderBottom: '1px solid #E2E8F0', marginBottom: '24px' };
  const getTabStyle = (tab: string): React.CSSProperties => ({
    padding: '12px 24px',
    cursor: 'pointer',
    fontWeight: activeSubTab === tab ? 600 : 400,
    color: activeSubTab === tab ? '#2563EB' : '#64748B',
    borderBottom: activeSubTab === tab ? '2px solid #2563EB' : 'none',
  });
  const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', backgroundColor: '#FFFFFF', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' };
  const thStyle: React.CSSProperties = { textAlign: 'left', padding: '14px 16px', backgroundColor: '#F1F5F9', color: '#475569', fontWeight: 600, fontSize: '13px', borderBottom: '1px solid #E2E8F0' };
  const tdStyle: React.CSSProperties = { padding: '14px 16px', borderBottom: '1px solid #E2E8F0', fontSize: '14px' };
  const roleBadgeStyle: React.CSSProperties = { backgroundColor: '#DBEAFE', color: '#1E40AF', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 };
  const actionBtnStyle: React.CSSProperties = { padding: '6px 12px', borderRadius: '4px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', cursor: 'pointer', fontSize: '12px' };

  if (loading) return <div style={{ padding: '24px', color: '#64748B' }}>Loading user directory from database...</div>;

  return (
    <div style={containerStyle}>
      <div style={headerContainerStyle}>
        <div>
          <h1 style={headerStyle}>User & Role Management</h1>
          <p style={{ color: '#64748B', margin: '4px 0 0', fontSize: '14px' }}>
            Managed DB users, RBAC roles, and tenant context
          </p>
        </div>
        {!isAuditor && (
          <button style={buttonStyle} onClick={() => setShowAddModal(true)}>
            + Add New User
          </button>
        )}
      </div>

      <div style={tabContainerStyle}>
        <div style={getTabStyle('users')} onClick={() => setActiveSubTab('users')}>Users ({users.length})</div>
        <div style={getTabStyle('roles')} onClick={() => setActiveSubTab('roles')}>Roles</div>
        <div style={getTabStyle('permissions')} onClick={() => setActiveSubTab('permissions')}>Permissions</div>
      </div>

      {activeSubTab === 'users' && (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>User ID</th>
              <th style={thStyle}>Email Address</th>
              <th style={thStyle}>Role</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Last Login</th>
              {!isAuditor && <th style={thStyle}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td style={tdStyle}>{u.id}</td>
                <td style={tdStyle}>{u.email}</td>
                <td style={tdStyle}><span style={roleBadgeStyle}>{u.roles}</span></td>
                <td style={tdStyle}><StatusBadge status={u.status} /></td>
                <td style={tdStyle}>{u.lastLogin}</td>
                {!isAuditor && (
                  <td style={tdStyle}>
                    <button style={actionBtnStyle}>Edit</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: '#FFFFFF', padding: '24px', borderRadius: '12px', width: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: '#0F172A' }}>Add User to Database</h2>
            <form onSubmit={handleAddUser}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Email</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', boxSizing: 'border-box' }}
                  required
                />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1' }}
                >
                  <option value="admin">Admin</option>
                  <option value="agent">Agent</option>
                  <option value="distributor">Distributor</option>
                  <option value="auditor">Auditor</option>
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={() => setShowAddModal(false)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={buttonStyle}>Save Record</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
