/**
 * Selah Design Tokens
 * Unified design scale for colors, typography, spacing, radius, shadows, and z-index.
 */

export const DESIGN_TOKENS = {
  icons: {
    sm: 16,
    md: 20,
    lg: 24,
    strokeWidth: 1.85
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    base: 16,
    lg: 20,
    xl: 24,
    '2xl': 32
  },
  radius: {
    xs: 4,
    sm: 6,
    md: 10,
    lg: 14,
    xl: 18,
    full: 9999
  },
  typography: {
    xs: '11px',
    sm: '12px',
    base: '13.5px',
    md: '15px',
    lg: '18px',
    xl: '22px',
    '2xl': '28px'
  },
  zIndex: {
    base: 1,
    header: 100,
    popover: 500,
    dropdown: 1000,
    tooltip: 1100,
    portal: 1200,
    modalBackdrop: 1300,
    modalContent: 1350,
    toast: 1500
  },
  colors: {
    dark: {
      bgApp: '#0b1020',
      bgCard: '#131b2e',
      bgCardHover: '#1c263f',
      textPrimary: '#f8fafc',
      textSecondary: '#cbd5e1',
      textMuted: '#94a3b8',
      accentPurple: '#a788fa',
      accentBlue: '#6366f1',
      accentCyan: '#38bdf8',
      borderSubtle: 'rgba(148, 163, 184, 0.16)',
      borderFocus: '#a788fa'
    },
    light: {
      bgApp: '#f4f6fb',
      bgCard: '#ffffff',
      bgCardHover: '#f8fafc',
      textPrimary: '#0f172a',
      textSecondary: '#475569',
      textMuted: '#64748b',
      accentPurple: '#7c3aed',
      accentBlue: '#4f46e5',
      accentCyan: '#0284c7',
      borderSubtle: '#e2e8f0',
      borderFocus: '#7c3aed'
    }
  }
} as const
