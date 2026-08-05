import React, { useState } from 'react';
import type { UserRole } from '../types';
import { FrameHeader } from '../components/FrameHeader';
import { SkuCatalog } from '../pages/inventory/SkuCatalog';
import { StockLedger } from '../pages/inventory/StockLedger';
import { OutletRegistry } from '../pages/inventory/OutletRegistry';
import { Invoices } from '../pages/finance/Invoices';
import { PricingSchemes } from '../pages/finance/PricingSchemes';

interface DmsFrameProps {
  role: UserRole;
  initialTab?: string;
}

export const DmsFrame: React.FC<DmsFrameProps> = ({ role, initialTab = 'sku-catalog' }) => {
  const [activeTab, setActiveTab] = useState(initialTab);

  const tabs = [
    { id: 'sku-catalog', label: 'SKU Master Catalog', icon: '📦' },
    { id: 'stock-ledger', label: 'Stock & Warehouse Ledger', icon: '📋' },
    { id: 'outlet-registry', label: 'Retailers & Credit Limits', icon: '🏪' },
    { id: 'invoices', label: 'Billing & Invoices', icon: '📄' },
    { id: 'pricing-schemes', label: 'Pricing & Schemes', icon: '🏷️' },
  ];

  const kpis = [
    { label: 'Stock Value', value: '$142,500', color: '#15803D' },
    { label: 'Active Outlets', value: '4 Outlets', color: '#1D4ED8' },
    { label: 'Low Stock Alerts', value: '2 SKUs', color: '#B45309' },
  ];

  return (
    <div>
      <FrameHeader
        frameTitle="DMS Supply Chain Frame"
        frameSubtitle="Manages distributors, SKU master catalog, stock depletion, billing, retailer credit limits & pricing schemes"
        frameIcon="🏢"
        badgeText="DISTRIBUTION ENGINE"
        badgeColor="#1D4ED8"
        kpis={kpis}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Frame Content View */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px' }}>
        {activeTab === 'sku-catalog' && <SkuCatalog role={role} />}
        {activeTab === 'stock-ledger' && <StockLedger role={role} />}
        {activeTab === 'outlet-registry' && <OutletRegistry role={role} />}
        {activeTab === 'invoices' && <Invoices role={role} />}
        {activeTab === 'pricing-schemes' && <PricingSchemes role={role} />}
      </div>
    </div>
  );
};
