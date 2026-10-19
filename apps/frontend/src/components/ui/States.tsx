import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Button } from './Button';

function StateShell({ children }: { children: React.ReactNode }) {
  return <View style={styles.shell}>{children}</View>;
}

/** Estado de carga centrado (listados, pantallas). */
export function LoadingState({ message = 'Cargando…' }: { message?: string }) {
  const theme = useTheme();
  return (
    <StateShell>
      <ActivityIndicator size="large" color={theme.colors.primary} />
      <Text style={[styles.message, { color: theme.colors.textMuted }]}>{message}</Text>
    </StateShell>
  );
}

/** Estado vacío (sin resultados). */
export function EmptyState({
  title = 'Sin datos',
  message = 'No hay registros que mostrar.',
}: {
  title?: string;
  message?: string;
}) {
  const theme = useTheme();
  return (
    <StateShell>
      <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
      <Text style={[styles.message, { color: theme.colors.textMuted }]}>{message}</Text>
    </StateShell>
  );
}

/** Estado de error con reintento. */
export function ErrorState({
  message = 'No se pudo cargar la información.',
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  const theme = useTheme();
  return (
    <StateShell>
      <Text style={[styles.title, { color: theme.colors.danger }]}>Algo salió mal</Text>
      <Text style={[styles.message, { color: theme.colors.textMuted }]}>{message}</Text>
      {onRetry ? <Button title="Reintentar" variant="secondary" onPress={onRetry} /> : null}
    </StateShell>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 16,
    gap: 10,
  },
  title: { fontSize: 16, fontWeight: '700' },
  message: { fontSize: 14, textAlign: 'center' },
});
