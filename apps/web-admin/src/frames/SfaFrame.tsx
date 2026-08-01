import React, { useState } from 'react';
import type { UserRole } from '../types';
import { FrameHeader } from '../components/FrameHeader';
import { BeatRoutes } from '../pages/sales/BeatRoutes';
import { FieldVisits } from '../pages/sales/FieldVisits';
import { SalesOrders } from '../pages/sales/SalesOrders';
import { VanSales } from '../pages/sales/VanSales';

interface SfaFrameProps {
  role: UserRole;
  initialTab?: string;
}

export const SfaFrame: React.FC<SfaFrameProps> = ({ role, initialTab = 'sales-orders' }) => {
  const [activeTab, setActiveTab] = useState(initialTab);

  const tabs = [
    { id: 'sales-orders', label: 'Field Order Collection', icon: '🛒' },
    { id: 'beat-routes', label: 'Beat & Route Planning', icon: '🗺️' },
    { id: 'field-visits', label: 'GPS Visit & Attendance', icon: '📍' },
    { id: 'van-sales', label: 'Van Sales Dispatch', icon: '🚚' },
  ];

  const kpis = [
    { label: 'Active Beats', value: '4 Beats', color: '#15803D' },
    { label: 'Visit Compliance', value: '98.2%', color: '#1D4ED8' },
    { label: 'Today Orders', value: '$12,420', color: '#0F172A' },
  ];

  return (
    <div>
      <FrameHeader
        frameTitle="SFA Field Operations Frame"
        frameSubtitle="Manages field sales reps, beat route planning, GPS geofenced check-ins, field order collection & van sales"
        frameIcon="📍"
        badgeText="FIELD FORCE AUTOMATION"
        badgeColor="#15803D"
        kpis={kpis}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Frame Content View */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px' }}>
        {activeTab === 'sales-orders' && <SalesOrders role={role} />}
        {activeTab === 'beat-routes' && <BeatRoutes role={role} />}
        {activeTab === 'field-visits' && <FieldVisits role={role} />}
        {activeTab === 'van-sales' && <VanSales role={role} />}
      </div>
    </div>
  );
};
