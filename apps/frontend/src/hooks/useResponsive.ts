import { useWindowDimensions } from 'react-native';
import { BREAKPOINTS } from '../constants/theme';

/**
 * Breakpoints responsive del layout:
 * - desktop (>=1024): sidebar fija con etiquetas.
 * - tablet  (>=768):  sidebar colapsada (sólo iconos).
 * - móvil   (<768):   barra superior + menú desplegable.
 */
export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const isDesktop = width >= BREAKPOINTS.desktop;
  const isTablet = !isDesktop && width >= BREAKPOINTS.tablet;
  const isMobile = width < BREAKPOINTS.tablet;
  return { width, height, isDesktop, isTablet, isMobile };
}
