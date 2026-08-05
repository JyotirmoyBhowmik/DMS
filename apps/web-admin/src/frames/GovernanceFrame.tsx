import React, { useState, useMemo } from 'react';
import type { UserRole } from '../types';
import { useData } from '../context/DataContext';
import { FrameHeader } from '../components/FrameHeader';
import { Invoices } from '../pages/finance/Invoices';
import { TradeClaims } from '../pages/finance/TradeClaims';
import { AuditLedger } from '../pages/admin/AuditLedger';

interface GovernanceFrameProps {
  role: UserRole;
  initialTab?: string;
}

export const GovernanceFrame: React.FC<GovernanceFrameProps> = ({ role, initialTab = 'invoices' }) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const { invoices, tradeClaims, auditChain } = useData();

  const tabs = [
    { id: 'invoices', label: 'Billing & Invoice Ledger', icon: '📄' },
    { id: 'trade-claims', label: 'Trade Claims Settlement', icon: '💰' },
    { id: 'audit-ledger', label: 'Blockchain Audit Chain', icon: '🛡️' },
  ];

  // Dynamic KPIs computed from DataContext
  const kpis = useMemo(() => {
    const totalBilled = invoices.reduce((sum, inv) => {
      return sum + (parseFloat(inv.amount.replace(/[^0-9.]/g, '')) || 0);
    }, 0);

    const pendingClaims = tradeClaims
      .filter(c => c.status === 'PENDING_APPROVAL')
      .reduce((sum, c) => sum + (parseFloat(c.amount.replace(/[^0-9.]/g, '')) || 0), 0);

    return [
      { label: 'Billed Revenue', value: `$${totalBilled.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, color: '#15803D' },
      { label: 'Pending Claims', value: `$${pendingClaims.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, color: pendingClaims > 0 ? '#B45309' : '#15803D' },
      { label: 'Audit Ledger', value: `${auditChain.length} BLOCKS`, color: '#1D4ED8' },
    ];
  }, [invoices, tradeClaims, auditChain]);

  return (
    <div>
      <FrameHeader
        frameTitle="Financial & Audit Governance Frame"
        frameSubtitle="Enforces financial ledger compliance, distributor trade claims authorization, tax accounting & immutable audit trails"
        frameIcon="💰"
        badgeText="FINANCIAL GOVERNANCE"
        badgeColor="#B45309"
        kpis={kpis}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Frame Content View */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px' }}>
        {activeTab === 'invoices' && <Invoices role={role} />}
        {activeTab === 'trade-claims' && <TradeClaims role={role} />}
        {activeTab === 'audit-ledger' && <AuditLedger role={role} />}
      </div>
    </div>
  );
};
