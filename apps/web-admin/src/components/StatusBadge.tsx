import React from 'react';

export type StatusVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface StatusBadgeProps {
  status: string;
  variant?: StatusVariant;
}

const SUCCESS_KEYWORDS = [
  'ACTIVE', 'HEALTHY', 'PAID', 'APPROVED', 'SETTLED',
  'SYNCHRONIZED', 'COMPLETED', 'CHECKED_IN', 'DELIVERED',
  'ENABLED', 'TRUE', 'SUCCESS', 'OK'
];

const WARNING_KEYWORDS = [
  'PENDING', 'PROCESSING', 'LOADING', 'PENDING_APPROVAL',
  'IN_TRANSIT', 'DISPATCHED', 'TOTP', 'SMS', 'IN_PROGRESS', 'WAITING'
];

const DANGER_KEYWORDS = [
  'OVERDUE', 'FAILED', 'REJECTED', 'SUSPENDED',
  'INACTIVE', 'MISSED', 'CREDIT_NOTE_ISSUED', 'FALSE', 'ERROR', 'CANCELLED'
];

const INFO_KEYWORDS = [
  'INFO', 'MICROSERVICE', 'GATEWAY', 'PLATFORM_PILLAR', 'APPLICATION', 'PROGRAM'
];

function autoDetectVariant(status: string): StatusVariant {
  const normalized = status.trim().toUpperCase();

  if (SUCCESS_KEYWORDS.includes(normalized)) return 'success';
  if (WARNING_KEYWORDS.includes(normalized)) return 'warning';
  if (DANGER_KEYWORDS.includes(normalized)) return 'danger';
  if (INFO_KEYWORDS.includes(normalized)) return 'info';

  return 'neutral';
}

const variantStyles: Record<StatusVariant, { bg: string; text: string; border: string }> = {
  success: { bg: '#DCFCE7', text: '#15803D', border: '#BBF7D0' },
  warning: { bg: '#FEF3C7', text: '#B45309', border: '#FDE68A' },
  danger: { bg: '#FEE2E2', text: '#B91C1C', border: '#FCA5A5' },
  info: { bg: '#DBEAFE', text: '#2563EB', border: '#BFDBFE' },
  neutral: { bg: '#F1F5F9', text: '#64748B', border: '#E2E8F0' },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, variant }) => {
  const resolvedVariant = variant || autoDetectVariant(status);
  const style = variantStyles[resolvedVariant] || variantStyles.neutral;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3px 10px',
        borderRadius: '9999px',
        fontSize: '11px',
        fontWeight: 600,
        lineHeight: 1.3,
        backgroundColor: style.bg,
        color: style.text,
        border: `1px solid ${style.border}`,
        whiteSpace: 'nowrap',
        letterSpacing: '0.025em',
        textTransform: 'uppercase',
      }}
    >
      {status}
    </span>
  );
};
