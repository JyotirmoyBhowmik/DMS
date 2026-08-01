import React, { useState } from 'react';
import { UserRole } from '../../types';
import { useData } from '../../context/DataContext';
import { StatusBadge } from '../../components/StatusBadge';
import { DISTRIBUTOR_NAMES } from '../../data/seed';
import { Modal } from '../../components/Modal';
import { FormField } from '../../components/FormField';
import { tokens } from '../../theme/tokens';

export const Invoices: React.FC<{ role: UserRole }> = ({ role }) => {
  const { invoices, addInvoice } = useData();
  const [showForm, setShowForm] = useState(false);
  const [customer, setCustomer] = useState(DISTRIBUTOR_NAMES[0]);
  const [amount, setAmount] = useState('10000.00');
  const [dueDate, setDueDate] = useState('2026-08-30');

  const canCreate = role === 'admin' || role === 'distributor';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(amount) || 0;
    const tax = (num * 0.08).toFixed(2);
    addInvoice({
      customer,
      amount: `$${num.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      taxAmount: `$${tax}`,
      dueDate,
    });
    setShowForm(false);
  };

  return (
    <div style={{ padding: '24px', backgroundColor: tokens.colors.bgApp, minHeight: '100vh', color: tokens.colors.textBody }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: tokens.colors.textMain, margin: 0 }}>Billing & Invoice Ledger</h1>
          <p style={{ color: tokens.colors.textMuted, margin: '4px 0 0', fontSize: '14px' }}>
            Automated secondary sales billing & 8% tax calculation
          </p>
        </div>

        {canCreate && (
          <button style={tokens.presets.buttonPrimary} onClick={() => setShowForm(true)}>
            + Generate Invoice
          </button>
        )}
      </div>

      <div style={{ backgroundColor: '#FFFFFF', border: `1px solid ${tokens.colors.border}`, borderRadius: '8px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: `1px solid ${tokens.colors.border}` }}>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: tokens.colors.textBody, fontSize: '13px' }}>Invoice ID</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: tokens.colors.textBody, fontSize: '13px' }}>Distributor / Customer</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: tokens.colors.textBody, fontSize: '13px' }}>Total Amount</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: tokens.colors.textBody, fontSize: '13px' }}>Tax Amount (8%)</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: tokens.colors.textBody, fontSize: '13px' }}>Status</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, color: tokens.colors.textBody, fontSize: '13px' }}>Due Date</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv, idx) => (
              <tr key={inv.id} style={{ borderBottom: idx === invoices.length - 1 ? 'none' : `1px solid ${tokens.colors.border}` }}>
                <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 600 }}>{inv.id}</td>
                <td style={{ padding: '12px 16px', fontWeight: 600, color: tokens.colors.textMain }}>{inv.customer}</td>
                <td style={{ padding: '12px 16px', fontWeight: 700 }}>{inv.amount}</td>
                <td style={{ padding: '12px 16px', color: tokens.colors.textMuted }}>{inv.taxAmount}</td>
                <td style={{ padding: '12px 16px' }}><StatusBadge status={inv.status} /></td>
                <td style={{ padding: '12px 16px', color: tokens.colors.textMuted, fontSize: '12px' }}>{inv.dueDate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal title="Generate Sales Invoice" subtitle="Issue bill to distributor with automatic tax calculation" isOpen={showForm} onClose={() => setShowForm(false)}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <FormField label="Customer / Distributor">
            <select value={customer} onChange={(e) => setCustomer(e.target.value)} style={tokens.presets.input}>
              {DISTRIBUTOR_NAMES.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </FormField>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <FormField label="Invoice Amount ($)">
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={tokens.presets.input}
                required
              />
            </FormField>

            <FormField label="Due Date">
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                style={tokens.presets.input}
                required
              />
            </FormField>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
            <button type="button" onClick={() => setShowForm(false)} style={tokens.presets.buttonSecondary}>Cancel</button>
            <button type="submit" style={tokens.presets.buttonPrimary}>Issue Invoice</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
