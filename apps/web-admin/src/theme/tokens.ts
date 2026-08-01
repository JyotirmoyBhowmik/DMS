// ── Centralized Design Tokens & Theme System ──

export const tokens = {
  colors: {
    bgApp: '#F8FAFC',
    bgSurface: '#FFFFFF',
    bgCard: '#FFFFFF',
    bgHeader: '#FFFFFF',
    bgDark: '#0F172A',
    bgSubtle: '#F1F5F9',
    
    textMain: '#0F172A',
    textBody: '#334155',
    textMuted: '#64748B',
    textLight: '#94A3B8',
    textWhite: '#FFFFFF',

    border: '#E2E8F0',
    borderSubtle: '#F1F5F9',
    borderDark: '#334155',

    brand: '#2563EB',
    brandDark: '#1D4ED8',
    brandLight: '#EFF6FF',

    success: '#15803D',
    successBg: '#DCFCE7',
    successBorder: '#BBF7D0',

    warning: '#B45309',
    warningBg: '#FEF3C7',
    warningBorder: '#FDE68A',

    danger: '#B91C1C',
    dangerBg: '#FEE2E2',
    dangerBorder: '#FCA5A5',

    info: '#2563EB',
    infoBg: '#DBEAFE',
    infoBorder: '#BFDBFE',
  },

  typography: {
    fontFamily: "'Inter', system-ui, sans-serif",
    fontSizeXs: '11px',
    fontSizeSm: '12px',
    fontSizeMd: '13px',
    fontSizeBase: '14px',
    fontSizeLg: '16px',
    fontSizeXl: '18px',
    fontSize2Xl: '20px',
    fontSize3Xl: '24px',

    fontWeightNormal: 400,
    fontWeightMedium: 500,
    fontWeightSemibold: 600,
    fontWeightBold: 700,
    fontWeightExtrabold: 800,
  },

  radii: {
    sm: '4px',
    md: '6px',
    lg: '8px',
    xl: '12px',
    pill: '9999px',
  },

  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -1px rgba(0, 0, 0, 0.04)',
    lg: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  },

  presets: {
    card: {
      backgroundColor: '#FFFFFF',
      borderRadius: '12px',
      border: '1px solid #E2E8F0',
      padding: '24px',
      boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    },
    buttonPrimary: {
      backgroundColor: '#0F172A',
      color: '#FFFFFF',
      padding: '10px 18px',
      borderRadius: '8px',
      border: 'none',
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: 600,
    },
    buttonSecondary: {
      backgroundColor: '#FFFFFF',
      color: '#334155',
      padding: '10px 18px',
      borderRadius: '8px',
      border: '1px solid #E2E8F0',
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: 600,
    },
    input: {
      width: '100%',
      padding: '9px 12px',
      borderRadius: '6px',
      border: '1px solid #CBD5E1',
      fontSize: '13px',
      outline: 'none',
      boxSizing: 'border-box' as const,
    },
  },
};
