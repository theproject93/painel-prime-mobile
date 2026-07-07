import { brandPalette } from '@painel-prime/ui';

export const colors = {
  background: brandPalette.background,
  surface: brandPalette.surface,
  surfaceSubtle: brandPalette.surfaceSubtle,
  card: brandPalette.card,
  text: brandPalette.text,
  textSecondary: brandPalette.textSecondary,
  mutedText: brandPalette.mutedText,
  primary: brandPalette.primary,
  primaryStrong: brandPalette.primaryStrong,
  primarySoft: brandPalette.primarySoft,
  primaryTextOn: brandPalette.primaryTextOn,
  accent: brandPalette.accent,
  aiAccent: brandPalette.aiAccent,
  border: brandPalette.border,
  borderStrong: brandPalette.borderStrong,
  successBg: brandPalette.successBg,
  successText: brandPalette.successText,
  warningBg: brandPalette.warningBg,
  warningText: brandPalette.warningText,
  dangerBg: brandPalette.dangerBg,
  dangerText: brandPalette.dangerText,
  infoBg: brandPalette.infoBg,
  infoText: brandPalette.infoText,
  gold50: '#FDF8ED',
  gold100: '#F6ECD2',
  gold200: '#E8D5A0',
  gold600: '#B8933A',
  gold700: '#9A7A2E',
  royal50: '#F4F2FF',
  royal100: '#E8E4FF',
  royal400: '#8B7DFF',
  royal600: '#5A4AE0',
  success100: '#D1F5E0',
  success600: '#178A55',
  warning100: '#FFECC0',
  danger100: '#FBD5D5',
  info100: '#DBEAFE',
  ink950: '#0F1115',
} as const;

export const gradients = {
  gold: ['#C9A54D', '#E8D5A0'] as const,
  goldVertical: ['#C9A54D', '#B8933A'] as const,
  royal: ['#6B5BFF', '#8B7DFF'] as const,
  success: ['#1F9D62', '#2BC47A'] as const,
  surface: ['#FFFFFF', '#F7F8FA'] as const,
  warm: ['#FDF8ED', '#F6ECD2'] as const,
  info: ['#2563EB', '#60A5FA'] as const,
  danger: ['#D14343', '#F87171'] as const,
} as const;

export const shadows = {
  card: { shadowColor: '#0F1115', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 2 } as const, elevation: 3 },
  elevated: { shadowColor: '#0F1115', shadowOpacity: 0.12, shadowRadius: 32, shadowOffset: { width: 0, height: 8 } as const, elevation: 8 },
  gold: { shadowColor: '#C9A54D', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 4 } as const, elevation: 6 },
  royal: { shadowColor: '#6B5BFF', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 4 } as const, elevation: 6 },
  sm: { shadowColor: '#0F1115', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 1 } as const, elevation: 1 },
} as const;

export const radii = { sm: 8, md: 12, lg: 16, xl: 20, full: 999 } as const;
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24 } as const;
