import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from './ThemeContext';

export type ToastTone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  show: (message: string, tone?: ToastTone) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const TONE_COLORS: Record<ToastTone, { bg: string; fg: string; border: string }> = {
  success: { bg: '#dcfce7', fg: '#14532d', border: '#16a34a' },
  error: { bg: '#fee2e2', fg: '#7f1d1d', border: '#dc2626' },
  info: { bg: '#dbeafe', fg: '#1e3a8a', border: '#2563eb' },
};

const TONE_COLORS_DARK: Record<ToastTone, { bg: string; fg: string; border: string }> = {
  success: { bg: '#052e1b', fg: '#bbf7d0', border: '#16a34a' },
  error: { bg: '#3f0d0d', fg: '#fecaca', border: '#dc2626' },
  info: { bg: '#0c1e3a', fg: '#bfdbfe', border: '#2563eb' },
};

const TOAST_DURATION_MS = 3800;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message: string, tone: ToastTone = 'info') => {
      const id = nextId.current++;
      setItems((prev) => [...prev.slice(-2), { id, message, tone }]);
      setTimeout(() => remove(id), TOAST_DURATION_MS);
    },
    [remove]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      show,
      success: (message: string) => show(message, 'success'),
      error: (message: string) => show(message, 'error'),
    }),
    [show]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastHost items={items} onDismiss={remove} />
    </ToastContext.Provider>
  );
}

function ToastHost({
  items,
  onDismiss,
}: {
  items: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  if (items.length === 0) return null;
  const palette = theme.scheme === 'dark' ? TONE_COLORS_DARK : TONE_COLORS;

  return (
    <View pointerEvents="box-none" style={[styles.host, { paddingTop: insets.top + 12 }]}>
      {items.map((item) => {
        const tone = palette[item.tone];
        return (
          <Text
            key={item.id}
            onPress={() => onDismiss(item.id)}
            style={[
              styles.toast,
              { backgroundColor: tone.bg, borderColor: tone.border, color: tone.fg },
            ]}
            numberOfLines={3}
          >
            {item.message}
          </Text>
        );
      })}
    </View>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de ToastProvider');
  return ctx;
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingHorizontal: 16,
    gap: 8,
  },
  toast: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    fontWeight: '600',
    overflow: 'hidden',
  },
});
