import React, { useState } from 'react';
import { UserRole, Invoice } from '../../types';
import { SEED_INVOICES } from '../../data/seed';
import { StatusBadge } from '../../components/StatusBadge';

const DISTRIBUTOR_NAMES = ['Alpha Distributors', 'Beta Logistics', 'Gamma Supplies'];

export const Invoices: React.FC<{ role: UserRole }> = ({ role }) => {
  const [invoices, setInvoices] = useState<Invoice[]>(SEED_INVOICES);
  const [showForm, setShowForm] = useState(false);
  const [newCustomer, setNewCustomer] = useState(DISTRIBUTOR_NAMES[0]);
  const [newAmount, setNewAmount] = useState<number | ''>('');

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAmount) return;

    const newInv: Invoice = {
      id: `INV-2026-${String(invoices.length + 1).padStart(3, '0')}`,
      customer: newCustomer,
      amount: `$${Number(newAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      taxAmount: `$${(Number(newAmount) * 0.08).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      status: 'PENDING',
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    };
    
    setInvoices([newInv, ...invoices]);
    setShowForm(false);
    setNewAmount('');
  };

  return (
    <div style={{ padding: '24px', backgroundColor: '#F8FAFC', minHeight: '100vh', color: '#334155', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ margin: 0, color: '#0F172A', fontSize: '24px', fontWeight: 'bold' }}>Invoices</h1>
        {role === 'admin' && (
          <button 
            onClick={() => setShowForm(!showForm)}
            style={{ padding: '8px 16px', backgroundColor: '#2563EB', color: '#FFFFFF', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 500 }}
          >
            {showForm ? 'Cancel' : '+ Generate Invoice'}
          </button>
        )}
      </div>

      {showForm && role === 'admin' && (
        <div style={{ backgroundColor: '#FFFFFF', padding: '24px', borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: '24px' }}>
          <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#0F172A' }}>New Invoice</h2>
          <form onSubmit={handleGenerate} style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Customer / Distributor</label>
              <select 
                value={newCustomer} 
                onChange={e => setNewCustomer(e.target.value)}
                style={{ width: '100%', padding: '8px', border: '1px solid #E2E8F0', borderRadius: '4px' }}
              >
                {DISTRIBUTOR_NAMES.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Amount ($)</label>
              <input 
                type="number" 
                value={newAmount} 
                onChange={e => setNewAmount(Number(e.target.value))}
                style={{ width: '100%', padding: '8px', border: '1px solid #E2E8F0', borderRadius: '4px' }}
                required
                min="1"
              />
              {newAmount !== '' && (
                <small style={{ color: '#64748B', display: 'block', marginTop: '4px' }}>
                  Auto-calculated 8% Tax: ${(Number(newAmount) * 0.08).toFixed(2)}
                </small>
              )}
            </div>
            <button type="submit" style={{ padding: '8px 24px', backgroundColor: '#15803D', color: '#FFFFFF', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 500, height: '35px' }}>
              Create
            </button>
          </form>
        </div>
      )}

      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              <th style={{ padding: '12px 16px', fontWeight: 500, color: '#64748B' }}>Invoice #</th>
              <th style={{ padding: '12px 16px', fontWeight: 500, color: '#64748B' }}>Distributor/Customer</th>
              <th style={{ padding: '12px 16px', fontWeight: 500, color: '#64748B' }}>Total Amount</th>
              <th style={{ padding: '12px 16px', fontWeight: 500, color: '#64748B' }}>Tax (8%)</th>
              <th style={{ padding: '12px 16px', fontWeight: 500, color: '#64748B' }}>Due Date</th>
              <th style={{ padding: '12px 16px', fontWeight: 500, color: '#64748B' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv, idx) => (
              <tr key={inv.id} style={{ borderBottom: idx === invoices.length - 1 ? 'none' : '1px solid #E2E8F0' }}>
                <td style={{ padding: '12px 16px', fontWeight: 500 }}>{inv.id}</td>
                <td style={{ padding: '12px 16px' }}>{inv.customer}</td>
                <td style={{ padding: '12px 16px' }}>{inv.amount}</td>
                <td style={{ padding: '12px 16px' }}>{inv.taxAmount}</td>
                <td style={{ padding: '12px 16px' }}>{inv.dueDate}</td>
                <td style={{ padding: '12px 16px' }}>
                  <StatusBadge status={inv.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
