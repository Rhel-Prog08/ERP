import { Platform } from 'react-native';
import { cardShadow } from '../constants/theme';

/**
 * Sistema de diseño CodeEvo: base navy/negro, azul principal y cian
 * tecnológico. `light` extiende la paleta histórica de constants/theme.ts;
 * `dark` mantiene la misma identidad en clave oscura.
 */

export type ThemeScheme = 'light' | 'dark';

export interface ThemeColors {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  /** Acento tecnológico (cian) de la identidad CodeEvo. */
  accent: string;
  sidebarBg: string;
  sidebarText: string;
  sidebarActiveBg: string;
  bg: string;
  card: string;
  border: string;
  text: string;
  textMuted: string;
  textLight: string;
  white: string;
  success: string;
  successBg: string;
  warning: string;
  warningBg: string;
  danger: string;
  dangerBg: string;
  neutral: string;
  neutralBg: string;
  infoBg: string;
  overlay: string;
}

export interface AppTheme {
  scheme: ThemeScheme;
  colors: ThemeColors;
  radii: { sm: number; md: number; lg: number; pill: number };
  fontSizes: { xs: number; sm: number; md: number; lg: number; xl: number; xxl: number };
  shadow: object;
}

const shared = {
  radii: { sm: 6, md: 10, lg: 14, pill: 999 },
  fontSizes: { xs: 12, sm: 13, md: 14, lg: 16, xl: 20, xxl: 26 },
};

const light: AppTheme = {
  scheme: 'light',
  colors: {
    primary: '#2563eb',
    primaryDark: '#1d4ed8',
    primaryLight: '#eff6ff',
    accent: '#0891b2',
    sidebarBg: '#0f172a',
    sidebarText: '#cbd5e1',
    sidebarActiveBg: '#1e293b',
    bg: '#f1f5f9',
    card: '#ffffff',
    border: '#e2e8f0',
    text: '#0f172a',
    textMuted: '#64748b',
    textLight: '#94a3b8',
    white: '#ffffff',
    success: '#16a34a',
    successBg: '#dcfce7',
    warning: '#d97706',
    warningBg: '#fef3c7',
    danger: '#dc2626',
    dangerBg: '#fee2e2',
    neutral: '#475569',
    neutralBg: '#e2e8f0',
    infoBg: '#dbeafe',
    overlay: 'rgba(15, 23, 42, 0.45)',
  },
  shadow: cardShadow,
  ...shared,
};

const darkColors: ThemeColors = {
  primary: '#3b82f6',
  primaryDark: '#2563eb',
  primaryLight: '#172554',
  accent: '#22d3ee',
  sidebarBg: '#070c18',
  sidebarText: '#94a3b8',
  sidebarActiveBg: '#111a2e',
  bg: '#0b1220',
  card: '#111a2e',
  border: '#1e293b',
  text: '#e2e8f0',
  textMuted: '#94a3b8',
  textLight: '#64748b',
  white: '#ffffff',
  success: '#4ade80',
  successBg: '#052e1b',
  warning: '#fbbf24',
  warningBg: '#3b2a06',
  danger: '#f87171',
  dangerBg: '#3f0d0d',
  neutral: '#94a3b8',
  neutralBg: '#1e293b',
  infoBg: '#0c1e3a',
  overlay: 'rgba(2, 6, 23, 0.6)',
};

const dark: AppTheme = {
  scheme: 'dark',
  colors: darkColors,
  shadow:
    Platform.OS === 'web'
      ? {
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.35,
          shadowRadius: 4,
          elevation: 2,
        }
      : { elevation: 2 },
  ...shared,
};

export const THEMES: Record<ThemeScheme, AppTheme> = { light, dark };
