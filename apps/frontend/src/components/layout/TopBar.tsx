import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useThemePreference } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useResponsive } from '../../hooks/useResponsive';

interface TopBarProps {
  /** Abre el menú lateral (sólo móvil). */
  onMenuPress: () => void;
  onLogout: () => void;
}

/** Barra superior: menú (móvil), toggle de tema, usuario y cierre de sesión. */
export function TopBar({ onMenuPress, onLogout }: TopBarProps) {
  const theme = useTheme();
  const c = theme.colors;
  const { setPreference } = useThemePreference();
  const { user } = useAuth();
  const { isMobile } = useResponsive();

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || '?'
    : '?';
  const fullName = user ? `${user.firstName} ${user.lastName}` : '';

  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: c.card, borderBottomColor: c.border },
      ]}
    >
      {isMobile ? (
        <Pressable
          onPress={onMenuPress}
          accessibilityRole="button"
          accessibilityLabel="Abrir menú de navegación"
          hitSlop={10}
          style={styles.iconButton}
        >
          <Ionicons name="menu" size={24} color={c.text} />
        </Pressable>
      ) : null}

      <View style={styles.brandMobile}>
        <View style={[styles.mark, { backgroundColor: c.primary }]}>
          <Text style={styles.markText}>C</Text>
        </View>
        <Text style={[styles.company, { color: c.text }]} numberOfLines={1}>
          {user?.company?.name ?? 'CodeEvo ERP'}
        </Text>
      </View>

      <View style={styles.right}>
        <Pressable
          onPress={() => setPreference(theme.scheme === 'dark' ? 'light' : 'dark')}
          accessibilityRole="button"
          accessibilityLabel="Cambiar tema"
          hitSlop={10}
          style={styles.iconButton}
        >
          <Ionicons
            name={theme.scheme === 'dark' ? 'sunny-outline' : 'moon-outline'}
            size={20}
            color={c.textMuted}
          />
        </Pressable>

        <View style={[styles.userChip, { backgroundColor: c.primaryLight }]}>
          <View style={[styles.avatar, { backgroundColor: c.primary }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={isMobile ? undefined : styles.userTexts}>
            {!isMobile ? (
              <>
                <Text style={[styles.userName, { color: c.text }]} numberOfLines={1}>
                  {fullName}
                </Text>
                <Text style={[styles.userRole, { color: c.textMuted }]} numberOfLines={1}>
                  {user?.role?.name ?? '—'}
                </Text>
              </>
            ) : null}
          </View>
        </View>

        <Pressable
          onPress={onLogout}
          accessibilityRole="button"
          accessibilityLabel="Cerrar sesión"
          hitSlop={10}
          style={styles.iconButton}
        >
          <Ionicons name="log-out-outline" size={22} color={c.danger} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 10,
    minHeight: 56,
  },
  brandMobile: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  mark: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  markText: { color: '#ffffff', fontWeight: '800', fontSize: 16 },
  company: { fontSize: 15, fontWeight: '700', flexShrink: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconButton: { padding: 8, borderRadius: 8 },
  userChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  userTexts: { paddingHorizontal: 6, maxWidth: 160 },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#ffffff', fontSize: 12, fontWeight: '800' },
  userName: { fontSize: 13, fontWeight: '700' },
  userRole: { fontSize: 11 },
});
