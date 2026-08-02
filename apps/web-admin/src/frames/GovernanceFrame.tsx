import React, { useState } from 'react';
import type { UserRole } from '../types';
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

  const tabs = [
    { id: 'invoices', label: 'Billing & Invoice Ledger', icon: '📄' },
    { id: 'trade-claims', label: 'Trade Claims Settlement', icon: '💰' },
    { id: 'audit-ledger', label: 'Blockchain Audit Chain', icon: '🛡️' },
  ];

  const kpis = [
    { label: 'Billed Revenue', value: '$51,570', color: '#15803D' },
    { label: 'Pending Claims', value: '$6,650', color: '#B45309' },
    { label: 'Audit Chain', value: 'VERIFIED', color: '#1D4ED8' },
  ];

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
