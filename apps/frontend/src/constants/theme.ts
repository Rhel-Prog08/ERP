import { Platform } from 'react-native';

/** Paleta común: primario #2563eb, tarjetas blancas, fondo gris claro. */
export const colors = {
  primary: '#2563eb',
  primaryDark: '#1d4ed8',
  primaryLight: '#eff6ff',
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
} as const;

export const radii = {
  sm: 6,
  md: 10,
  lg: 14,
  pill: 999,
} as const;

export const fontSizes = {
  xs: 12,
  sm: 13,
  md: 14,
  lg: 16,
  xl: 20,
  xxl: 26,
} as const;

export const BREAKPOINTS = {
  /** >= 1024px → sidebar fija */
  desktop: 1024,
  /** 768–1023 → sidebar colapsada (sólo iconos) */
  tablet: 768,
} as const;

/** Sombra sutil (en web react-native-web la traduce a box-shadow). */
export const cardShadow =
  Platform.OS === 'web'
    ? {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
      }
    : { elevation: 2 };
