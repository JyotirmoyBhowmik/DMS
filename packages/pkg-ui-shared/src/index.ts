export const DesignTokens = {
  colors: {
    primary: '#1E3A8A',
    secondary: '#10B981',
    background: '#0F172A',
    text: '#F8FAFC',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
  },
  typography: {
    fontFamily: 'Inter, sans-serif',
    h1: { fontSize: '32px', fontWeight: 'bold' },
    body: { fontSize: '14px', fontWeight: 'normal' },
  }
};

/** Mask permanent account number (PAN) leaving only first 2 and last 2 visible */
export function maskPan(pan: string): string {
  if (!pan || pan.length < 6) return '**********';
  const start = pan.slice(0, 2);
  const end = pan.slice(-2);
  return `${start}******${end}`;
}

/** Mask phone number leaving only the last 4 digits visible */
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 4) return '******';
  const end = phone.slice(-4);
  return `******${end}`;
}

/** Format currency amounts for display */
export function formatMoney(amount: number, currency = 'INR'): string {
  const symbol = currency === 'INR' ? '₹' : currency;
  const formatted = amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol}${formatted}`;
}
