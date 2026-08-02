import React from 'react';

export interface FrameTab {
  id: string;
  label: string;
  icon?: string;
  badge?: string;
}

export interface FrameKpi {
  label: string;
  value: string;
  color?: string;
}

interface FrameHeaderProps {
  frameTitle: string;
  frameSubtitle: string;
  frameIcon: string;
  badgeText: string;
  badgeColor?: string;
  kpis?: FrameKpi[];
  tabs: FrameTab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export const FrameHeader: React.FC<FrameHeaderProps> = ({
  frameTitle,
  frameSubtitle,
  frameIcon,
  badgeText,
  badgeColor = '#2563EB',
  kpis = [],
  tabs,
  activeTab,
  onTabChange,
}) => {
  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '12px',
        border: '1px solid #E2E8F0',
        padding: '20px 24px 0',
        marginBottom: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      {/* Top Banner Row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '10px',
              backgroundColor: '#0F172A',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
            }}
          >
            {frameIcon}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0F172A', margin: 0, letterSpacing: '-0.01em' }}>
                {frameTitle}
              </h2>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  color: '#FFFFFF',
                  backgroundColor: badgeColor,
                  padding: '3px 10px',
                  borderRadius: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {badgeText}
              </span>
            </div>
            <p style={{ fontSize: '13px', color: '#64748B', margin: '4px 0 0' }}>
              {frameSubtitle}
            </p>
          </div>
        </div>

        {/* Frame KPI Counters */}
        {kpis.length > 0 && (
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            {kpis.map((kpi, idx) => (
              <div
                key={idx}
                style={{
                  backgroundColor: '#F8FAFC',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  textAlign: 'right',
                }}
              >
                <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {kpi.label}
                </div>
                <div style={{ fontSize: '18px', fontWeight: '800', color: kpi.color || '#0F172A', marginTop: '2px' }}>
                  {kpi.value}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Frame Sub-Tab Navigation Bar */}
      <div style={{ display: 'flex', gap: '4px', borderTop: '1px solid #F1F5F9', paddingTop: '4px' }}>
        {tabs.map((t) => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 18px',
                border: 'none',
                borderBottom: isActive ? '3px solid #0F172A' : '3px solid transparent',
                backgroundColor: 'transparent',
                color: isActive ? '#0F172A' : '#64748B',
                fontWeight: isActive ? '700' : '500',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.12s ease',
              }}
            >
              {t.icon && <span style={{ fontSize: '15px' }}>{t.icon}</span>}
              <span>{t.label}</span>
              {t.badge && (
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: '700',
                    backgroundColor: isActive ? '#EFF6FF' : '#F1F5F9',
                    color: isActive ? '#1D4ED8' : '#64748B',
                    padding: '2px 7px',
                    borderRadius: '10px',
                  }}
                >
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
