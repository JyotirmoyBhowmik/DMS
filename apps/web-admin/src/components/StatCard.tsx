import React from 'react';

export interface StatCardProps {
  label: string;
  value: string;
  change: string;
  changeType: 'positive' | 'neutral' | 'negative';
  subtitle: string;
}

const changeTypeColors: Record<'positive' | 'neutral' | 'negative', string> = {
  positive: '#15803D', // Success
  neutral: '#64748B',  // Muted
  negative: '#B91C1C', // Danger
};

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  change,
  changeType,
  subtitle,
}) => {
  const changeColor = changeTypeColors[changeType] || changeTypeColors.neutral;

  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: '8px',
        padding: '20px',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <div
        style={{
          fontSize: '11px',
          fontWeight: 600,
          textTransform: 'uppercase',
          color: '#64748B',
          letterSpacing: '0.05em',
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: '28px',
          fontWeight: 700,
          color: '#0F172A',
          lineHeight: 1.2,
        }}
      >
        {value}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '12px',
          lineHeight: 1.4,
        }}
      >
        <span
          style={{
            fontWeight: 600,
            color: changeColor,
          }}
        >
          {change}
        </span>
        <span
          style={{
            color: '#64748B',
          }}
        >
          {subtitle}
        </span>
      </div>
    </div>
  );
};
