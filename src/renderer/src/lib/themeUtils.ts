export type ThemePreference = 'dark' | 'light' | 'system'
export type AccentColorId = 'violet' | 'indigo' | 'blue' | 'emerald' | 'rose' | 'amber'

export interface AccentPalette {
  id: AccentColorId
  label: string
  main: string
  hover: string
  btn: string
  bg: string
  glow: string
  borderCard: string
  borderFocus: string
  onAccent: string
}

export const ACCENT_PALETTES: Record<AccentColorId, AccentPalette> = {
  violet: {
    id: 'violet',
    label: 'Violet',
    main: '#a788fa',
    hover: '#9065f5',
    btn: '#a788fa',
    bg: 'rgba(167, 136, 250, 0.14)',
    glow: 'rgba(167, 136, 250, 0.25)',
    borderCard: 'rgba(167, 136, 250, 0.16)',
    borderFocus: 'rgba(167, 136, 250, 0.5)',
    onAccent: '#0b1020'
  },
  indigo: {
    id: 'indigo',
    label: 'Indigo',
    main: '#818cf8',
    hover: '#6366f1',
    btn: '#6366f1',
    bg: 'rgba(99, 102, 241, 0.16)',
    glow: 'rgba(99, 102, 241, 0.28)',
    borderCard: 'rgba(99, 102, 241, 0.2)',
    borderFocus: 'rgba(99, 102, 241, 0.5)',
    onAccent: '#ffffff'
  },
  blue: {
    id: 'blue',
    label: 'Blue',
    main: '#60a5fa',
    hover: '#3b82f6',
    btn: '#3b82f6',
    bg: 'rgba(59, 130, 246, 0.16)',
    glow: 'rgba(59, 130, 246, 0.28)',
    borderCard: 'rgba(59, 130, 246, 0.2)',
    borderFocus: 'rgba(59, 130, 246, 0.5)',
    onAccent: '#ffffff'
  },
  emerald: {
    id: 'emerald',
    label: 'Emerald',
    main: '#34d399',
    hover: '#10b981',
    btn: '#10b981',
    bg: 'rgba(16, 185, 129, 0.16)',
    glow: 'rgba(16, 185, 129, 0.28)',
    borderCard: 'rgba(16, 185, 129, 0.2)',
    borderFocus: 'rgba(16, 185, 129, 0.5)',
    onAccent: '#052e16'
  },
  rose: {
    id: 'rose',
    label: 'Rose',
    main: '#fb7185',
    hover: '#f43f5e',
    btn: '#f43f5e',
    bg: 'rgba(244, 63, 94, 0.16)',
    glow: 'rgba(244, 63, 94, 0.28)',
    borderCard: 'rgba(244, 63, 94, 0.2)',
    borderFocus: 'rgba(244, 63, 94, 0.5)',
    onAccent: '#ffffff'
  },
  amber: {
    id: 'amber',
    label: 'Amber',
    main: '#fbbf24',
    hover: '#f59e0b',
    btn: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.16)',
    glow: 'rgba(245, 158, 11, 0.28)',
    borderCard: 'rgba(245, 158, 11, 0.2)',
    borderFocus: 'rgba(245, 158, 11, 0.5)',
    onAccent: '#0b1020'
  }
}

export function resolveEffectiveTheme(pref: ThemePreference, systemPrefersDark: boolean): 'dark' | 'light' {
  if (pref === 'system') return systemPrefersDark ? 'dark' : 'light'
  return pref
}

export function isValidAccentColor(value: string | null | undefined): value is AccentColorId {
  return Boolean(value && value in ACCENT_PALETTES)
}

export function applyAccentPalette(root: HTMLElement, accentId: AccentColorId): void {
  const palette = ACCENT_PALETTES[accentId] || ACCENT_PALETTES.violet
  root.style.setProperty('--accent-purple', palette.main)
  root.style.setProperty('--accent-purple-hover', palette.hover)
  root.style.setProperty('--accent-purple-btn', palette.btn)
  root.style.setProperty('--accent-purple-bg', palette.bg)
  root.style.setProperty('--accent-purple-glow', palette.glow)
  root.style.setProperty('--border-card', palette.borderCard)
  root.style.setProperty('--border-focus', palette.borderFocus)
  root.style.setProperty('--btn-active-bg', palette.bg)
  root.style.setProperty('--text-on-accent', palette.onAccent)
}

