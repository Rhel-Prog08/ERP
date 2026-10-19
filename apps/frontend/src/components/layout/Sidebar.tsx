import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { Link, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { visibleNavGroups } from '../../navigation/navItems';

interface SidebarProps {
  /** Tablet: sólo iconos. */
  collapsed?: boolean;
  /** Móvil (drawer): el ancho lo decide el contenedor (máx. 280 px). */
  fill?: boolean;
  /** Se invoca tras pulsar un ítem (para cerrar el menú móvil). */
  onNavigate?: () => void;
}

/** Barra lateral de navegación con RBAC y activo por ruta. */
export function Sidebar({ collapsed = false, fill = false, onNavigate }: SidebarProps) {
  const theme = useTheme();
  const c = theme.colors;
  const { user, can } = useAuth();
  const pathname = usePathname();

  const groups = visibleNavGroups(new Set(user?.role?.permissions ?? []));

  return (
    <View
      style={[
        styles.sidebar,
        {
          backgroundColor: c.sidebarBg,
          width: fill ? '100%' : collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH,
          // Drawer (contenedor en columna): fija la altura para que el
          // ScrollView del menú quede limitado y pueda desplazarse.
          height: fill ? '100%' : undefined,
        },
      ]}
    >
      {/* Marca */}
      <View style={styles.brand}>
        <View style={[styles.brandMark, { backgroundColor: c.primary }]}>
          <Text style={styles.brandMarkText}>C</Text>
        </View>
        {!collapsed ? (
          <View>
            <Text style={styles.brandName}>CodeEvo</Text>
            <Text style={styles.brandSub}>ERP</Text>
          </View>
        ) : null}
      </View>

      {/* Módulos visibles según permisos (desplazable) */}
      <ScrollView
        style={styles.groups}
        contentContainerStyle={styles.groupsContent}
        showsVerticalScrollIndicator={false}
      >
        {groups.map((group) => (
          <View key={group.key} style={styles.group}>
            {!collapsed ? <Text style={styles.groupLabel}>{group.label.toUpperCase()}</Text> : null}
            {group.items.map((item) => {
              const hrefPath = typeof item.href === 'string' ? item.href : '';
              const active =
                hrefPath === '/' ? pathname === '/' : hrefPath !== '' && pathname.startsWith(hrefPath);
              if (!can(item.permission)) return null;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  asChild
                  onPress={onNavigate}
                >
                  <Pressable
                    accessibilityRole="link"
                    style={({ pressed }) => [
                      styles.item,
                      collapsed && styles.itemCollapsed,
                      {
                        backgroundColor: active ? c.sidebarActiveBg : 'transparent',
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <View style={[styles.link, collapsed ? styles.linkCollapsed : null]}>
                      <Ionicons
                        name={item.icon}
                        size={20}
                        color={active ? c.accent : c.sidebarText}
                      />
                      {!collapsed ? (
                        <Text
                          style={[
                            styles.itemLabel,
                            { color: active ? '#ffffff' : c.sidebarText },
                          ]}
                          numberOfLines={1}
                        >
                          {item.label}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                </Link>
              );
            })}
          </View>
        ))}
        {groups.length === 0 ? (
          <Text style={styles.empty}>Sin módulos asignados a tu rol.</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const SIDEBAR_WIDTH = 248;
const SIDEBAR_COLLAPSED_WIDTH = 72;

const styles = StyleSheet.create({
  // Ancho fijo: sin flexGrow/flexShrink que lo dilaten (Yoga ignora `width`
  // en el eje principal si el nodo tiene flex activo → se repartía 50/50).
  sidebar: { flexGrow: 0, flexShrink: 0, paddingTop: 16 },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 18,
  },
  brandMark: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMarkText: { color: '#ffffff', fontSize: 20, fontWeight: '800' },
  brandName: { color: '#ffffff', fontSize: 17, fontWeight: '800' },
  brandSub: { color: '#94a3b8', fontSize: 11, fontWeight: '600', letterSpacing: 1 },
  // ScrollView: la navegación queda desplazable si supera la altura
  // disponible (sólo aparece la barra vertical cuando hace falta).
  groups: { flex: 1 },
  groupsContent: { paddingHorizontal: 10, paddingBottom: 16, gap: 14 },
  group: { gap: 2 },
  groupLabel: { color: '#64748b', fontSize: 10, fontWeight: '800', paddingHorizontal: 8, paddingBottom: 4 },
  item: { borderRadius: 8, minHeight: 40, justifyContent: 'center' },
  itemCollapsed: { alignItems: 'center' },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  linkCollapsed: { justifyContent: 'center', paddingHorizontal: 0 },
  itemLabel: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
  empty: { color: '#64748b', fontSize: 12, paddingHorizontal: 8 },
});
