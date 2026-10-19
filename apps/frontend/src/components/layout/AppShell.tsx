import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useResponsive } from '../../hooks/useResponsive';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

interface AppShellProps {
  children: React.ReactNode;
}

/**
 * Layout responsive del ERP:
 * - PC (>=1024): sidebar fija con etiquetas.
 * - Tablet (>=768): sidebar colapsada (sólo iconos).
 * - Móvil (<768): barra superior con menú desplegable + scrim.
 */
export function AppShell({ children }: AppShellProps) {
  const theme = useTheme();
  const c = theme.colors;
  const { isTablet, isMobile } = useResponsive();
  const { logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        {/* fila: sidebar + columna principal */}
        <View style={styles.row}>
          {/* Sidebar permanente (PC / tablet) */}
          {!isMobile ? <Sidebar collapsed={isTablet} /> : null}

          <View style={styles.main}>
            <TopBar
              onMenuPress={() => setMenuOpen(true)}
              onLogout={() => {
                void logout();
              }}
            />
            <View style={styles.content}>{children}</View>
          </View>

          {/* Menú móvil (overlay): el drawer se despliega desde la izquierda */}
          {isMobile && menuOpen ? (
            <View style={styles.overlay}>
              <View style={styles.drawer}>
                <Sidebar fill onNavigate={() => setMenuOpen(false)} />
              </View>
              <Pressable
                style={[styles.scrim, { backgroundColor: c.overlay }]}
                onPress={() => setMenuOpen(false)}
                accessibilityLabel="Cerrar menú"
              />
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  row: { flex: 1, flexDirection: 'row' },
  main: { flex: 1, minWidth: 0 },
  content: { flex: 1 },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    zIndex: 100,
  },
  scrim: { flex: 1 },
  // Drawer móvil: hasta 280 px o el espacio disponible si la pantalla es más estrecha.
  drawer: { width: 280, maxWidth: '100%', flexGrow: 0, flexShrink: 1, overflow: 'hidden' },
});
