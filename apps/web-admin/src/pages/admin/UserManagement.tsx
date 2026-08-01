import React, { useState } from 'react';
import { UserRole } from '../../types';
import { SEED_USERS } from '../../data/seed';
import { StatusBadge } from '../../components/StatusBadge';

interface UserManagementProps {
  role: UserRole;
}

export const UserManagement: React.FC<UserManagementProps> = ({ role }) => {
  const [users, setUsers] = useState(SEED_USERS);
  const [activeTab, setActiveTab] = useState('Users');
  const [showAddForm, setShowAddForm] = useState(false);

  const isAdmin = role === 'admin';
  const isAuditor = role === 'auditor';

  const containerStyle: React.CSSProperties = { padding: '24px', backgroundColor: '#F8FAFC', minHeight: '100vh', color: '#334155' };
  const headerStyle: React.CSSProperties = { fontSize: '24px', fontWeight: 'bold', color: '#0F172A', marginBottom: '16px' };
  const tabsStyle: React.CSSProperties = { display: 'flex', gap: '16px', borderBottom: '1px solid #E2E8F0', marginBottom: '24px' };
  const getTabStyle = (tab: string): React.CSSProperties => ({
    padding: '8px 16px', cursor: 'pointer', color: activeTab === tab ? '#2563EB' : '#64748B', borderBottom: activeTab === tab ? '2px solid #2563EB' : 'none', fontWeight: activeTab === tab ? 600 : 400
  });
  const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', backgroundColor: '#FFFFFF', borderRadius: '8px', overflow: 'hidden', border: '1px solid #E2E8F0' };
  const thStyle: React.CSSProperties = { padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#64748B', fontWeight: 600, fontSize: '14px' };
  const tdStyle: React.CSSProperties = { padding: '12px 16px', borderBottom: '1px solid #E2E8F0', fontSize: '14px' };
  const buttonStyle: React.CSSProperties = { backgroundColor: '#2563EB', color: '#FFFFFF', padding: '8px 16px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 };
  const actionBtnStyle: React.CSSProperties = { backgroundColor: 'transparent', color: '#2563EB', border: '1px solid #2563EB', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' };
  const roleBadgeStyle: React.CSSProperties = { backgroundColor: '#DBEAFE', color: '#1E40AF', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 500 };
  const formStyle: React.CSSProperties = { backgroundColor: '#FFFFFF', padding: '20px', borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: '24px' };

  return (
    <div style={containerStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={headerStyle}>User Management</h1>
        {isAdmin && <button style={buttonStyle} onClick={() => setShowAddForm(!showAddForm)}>+ Add User</button>}
      </div>

      <div style={tabsStyle}>
        {['Users', 'Roles', 'Tenants', 'Permissions', 'MFA'].map(t => (
          <div key={t} style={getTabStyle(t)} onClick={() => setActiveTab(t)}>{t}</div>
        ))}
      </div>

      {showAddForm && isAdmin && (
        <div style={formStyle}>
          <h3 style={{ marginTop: 0 }}>Add New User</h3>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            <input placeholder="Email" style={{ padding: '8px', borderRadius: '4px', border: '1px solid #E2E8F0', flex: 1 }} />
            <select style={{ padding: '8px', borderRadius: '4px', border: '1px solid #E2E8F0' }}>
              <option>Admin</option><option>User</option>
            </select>
          </div>
          <button style={buttonStyle} onClick={() => setShowAddForm(false)}>Save User</button>
        </div>
      )}

      {activeTab === 'Users' && (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>ID</th><th style={thStyle}>Email</th><th style={thStyle}>Role</th><th style={thStyle}>Status</th><th style={thStyle}>Last Login</th>
              {!isAuditor && <th style={thStyle}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td style={tdStyle}>{u.id}</td>
                <td style={tdStyle}>{u.email}</td>
                <td style={tdStyle}><span style={roleBadgeStyle}>{u.roles}</span></td>
                <td style={tdStyle}><StatusBadge status={u.status} /></td>
                <td style={tdStyle}>{u.lastLogin}</td>
                {!isAuditor && <td style={tdStyle}><button style={actionBtnStyle}>Edit</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};
