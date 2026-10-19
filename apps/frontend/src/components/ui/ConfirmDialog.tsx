import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Button } from './Button';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Estilo de peligro (destructive) para el botón de confirmar. */
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Diálogo de confirmación (cancelaciones, borrados lógicos, etc.). */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const theme = useTheme();
  const c = theme.colors;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={[styles.backdrop, { backgroundColor: c.overlay }]} onPress={onCancel}>
        <Pressable
          style={[styles.dialog, { backgroundColor: c.card, borderColor: c.border }]}
          onPress={() => {
            // Evita que el toque cierre el diálogo al pulsar dentro.
          }}
        >
          <Text style={[styles.title, { color: c.text }]}>{title}</Text>
          <Text style={[styles.message, { color: c.textMuted }]}>{message}</Text>
          <View style={styles.actions}>
            <Button title={cancelLabel} variant="ghost" onPress={onCancel} disabled={loading} />
            <Button
              title={confirmLabel}
              variant={destructive ? 'danger' : 'primary'}
              onPress={onConfirm}
              loading={loading}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  dialog: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderRadius: 14,
    padding: 20,
    gap: 10,
  },
  title: { fontSize: 17, fontWeight: '700' },
  message: { fontSize: 14, lineHeight: 20 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
});
