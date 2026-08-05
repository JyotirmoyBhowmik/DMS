import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { LandingLayout } from './layouts/LandingLayout';
import { AppLayout } from './layouts/AppLayout';

import { Overview } from './pages/Overview';
import { PlatformRegistry } from './pages/PlatformRegistry';
import { Identity } from './pages/Identity';
import { DmsCore } from './pages/DmsCore';
import { Sfa } from './pages/Sfa';
import { PricingSchemes } from './pages/PricingSchemes';
import { ClaimsFinance } from './pages/ClaimsFinance';
import { AiForecasting } from './pages/AiForecasting';
import { AuditLogs } from './pages/AuditLogs';
import { IntegrationSync } from './pages/IntegrationSync';
import { ConfigNotify } from './pages/ConfigNotify';

const AppContent = () => {
  const { isAuthenticated, isDemoMode, activeTab } = useApp();

  if (!isAuthenticated && !isDemoMode) {
    return <LandingLayout />;
  }

  return (
    <AppLayout>
      {String(activeTab) === 'overview' && <Overview />}
      {String(activeTab) === 'platform-registry' && <PlatformRegistry />}
      {String(activeTab) === 'identity' && <Identity />}
      {String(activeTab) === 'dms-core' && <DmsCore />}
      {String(activeTab) === 'sfa' && <Sfa />}
      {String(activeTab) === 'pricing-schemes' && <PricingSchemes />}
      {String(activeTab) === 'claims-finance' && <ClaimsFinance />}
      {String(activeTab) === 'ai-forecasting' && <AiForecasting />}
      {String(activeTab) === 'audit-logs' && <AuditLogs />}
      {String(activeTab) === 'integration-sync' && <IntegrationSync />}
      {String(activeTab) === 'config-file-notify' && <ConfigNotify />}
    </AppLayout>
  );
};

export const App = () => {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
};

export default App;
