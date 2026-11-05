export const colors = {
  bg: '#080610',
  bgDeep: '#050309',
  plum: '#170B2E',
  plumLight: '#241243',
  purple: '#8B5CF6',
  magenta: '#D946EF',
  pink: '#EC4899',
  gold: '#FFD765',
  goldDeep: '#E9A826',
  blue: '#4F8CFF',
  cyan: '#22D3EE',
  white: '#FFFFFF',
  text: '#FFFFFF',
  textDim: 'rgba(255,255,255,0.68)',
  textFaint: 'rgba(255,255,255,0.42)',
  glass: 'rgba(255,255,255,0.07)',
  glassStrong: 'rgba(255,255,255,0.13)',
  glassBorder: 'rgba(255,255,255,0.14)',
  scrim: 'rgba(5,3,9,0.62)',
  danger: '#FB3B66',
  success: '#34D399',
} as const;

export const gradients = {
  accent: ['#8B5CF6', '#D946EF', '#EC4899'] as const,
  accentSoft: ['rgba(139,92,246,0.34)', 'rgba(236,72,153,0.2)'] as const,
  gold: ['#FFF1BE', '#FFD765', '#E9A826'] as const,
  night: ['#170B2E', '#080610'] as const,
  panel: ['rgba(255,255,255,0.11)', 'rgba(255,255,255,0.04)'] as const,
  video: ['#8B5CF6', '#EC4899'] as const,
  audio: ['#3B82F6', '#22D3EE'] as const,
  match: ['#F59E0B', '#EC4899'] as const,
  scrimBottom: ['transparent', 'rgba(5,3,9,0.92)'] as const,
};

export const fonts = {
  regular: 'Outfit_400Regular',
  medium: 'Outfit_500Medium',
  semibold: 'Outfit_600SemiBold',
  bold: 'Outfit_700Bold',
  black: 'Outfit_800ExtraBold',
} as const;

/** Fills the parent. */
export const fill = { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 } as const;

export const radius = { sm: 10, md: 16, lg: 22, xl: 28, pill: 999 } as const;
