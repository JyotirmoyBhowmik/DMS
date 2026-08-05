import React, { useState } from 'react';
import type { UserRole } from '../types';
import { FrameHeader } from '../components/FrameHeader';
import { AiForecast } from '../pages/analytics/AiForecast';
import { Reports } from '../pages/analytics/Reports';

interface AnalyticsFrameProps {
  role: UserRole;
  initialTab?: string;
}

export const AnalyticsFrame: React.FC<AnalyticsFrameProps> = ({ role, initialTab = 'ai-forecast' }) => {
  const [activeTab, setActiveTab] = useState(initialTab);

  const tabs = [
    { id: 'ai-forecast', label: 'AI Demand Forecasting Engine', icon: '⚡' },
    { id: 'reports', label: 'Executive Analytics & Reports', icon: '📈' },
  ];

  const kpis = [
    { label: 'Forecast Accuracy', value: '95.4%', color: '#15803D' },
    { label: 'Growth Trend', value: '+14.2%', color: '#1D4ED8' },
  ];

  return (
    <div>
      <FrameHeader
        frameTitle="AI & Executive Analytics Frame"
        frameSubtitle="Provides ML demand forecasting models, seasonality reorder projections, and executive secondary sales analytics"
        frameIcon="⚡"
        badgeText="AI & INTELLIGENCE"
        badgeColor="#7C3AED"
        kpis={kpis}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Frame Content View */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px' }}>
        {activeTab === 'ai-forecast' && <AiForecast role={role} />}
        {activeTab === 'reports' && <Reports role={role} />}
      </div>
    </div>
  );
};
