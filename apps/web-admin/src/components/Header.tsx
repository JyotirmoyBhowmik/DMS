import React, { ReactNode } from 'react';

export interface HeaderProps {
  title: string;
  subtitle: string;
  actions?: ReactNode;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  actions,
}) => {
  return (
    <header
      style={{
        height: '64px',
        backgroundColor: '#FFFFFF',
        borderBottom: '1px solid #E2E8F0',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxSizing: 'border-box',
        width: '100%',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <h1
          style={{
            fontSize: '18px',
            fontWeight: 700,
            color: '#0F172A',
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          {title}
        </h1>
        <p
          style={{
            fontSize: '12px',
            color: '#64748B',
            margin: '2px 0 0 0',
          }}
        >
          {subtitle}
        </p>
      </div>

      {actions && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          {actions}
        </div>
      )}
    </header>
  );
};
