import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

interface SelectProps<T extends string = string> {
  label: string;
  value: T | null | undefined;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  containerStyle?: React.ComponentProps<typeof View>['style'];
}

/**
 * Selector multiplataforma propio (web + nativo) con desplegable flotante.
 * Evita librerías nativas que no soportan react-native-web.
 */
export function Select<T extends string = string>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Selecciona una opción',
  error,
  disabled = false,
  containerStyle,
}: SelectProps<T>) {
  const theme = useTheme();
  const c = theme.colors;
  const [open, setOpen] = useState(false);

  const selected = options.find((o) => o.value === value);

  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={[styles.label, { color: c.text }]}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={() => setOpen((v) => !v)}
        style={[
          styles.field,
          {
            borderColor: error ? c.danger : open ? c.primary : c.border,
            backgroundColor: c.card,
            opacity: disabled ? 0.6 : 1,
          },
        ]}
      >
        <Text
          style={[
            styles.value,
            { color: selected ? c.text : c.textLight },
          ]}
          numberOfLines={1}
        >
          {selected ? selected.label : placeholder}
        </Text>
        <Text style={{ color: c.textMuted, fontSize: 12, marginLeft: 8 }}>
          {open ? '▲' : '▼'}
        </Text>
      </Pressable>

      {open ? (
        <View style={[styles.dropdown, { backgroundColor: c.card, borderColor: c.border }, theme.shadow]}>
          <ScrollView style={styles.options} keyboardShouldPersistTaps="handled">
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <Pressable
                  key={option.value}
                  disabled={option.disabled}
                  onPress={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.option,
                    {
                      backgroundColor: isSelected
                        ? c.primaryLight
                        : pressed
                          ? c.neutralBg
                          : 'transparent',
                      opacity: option.disabled ? 0.5 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.optionLabel,
                      { color: isSelected ? c.primary : c.text },
                    ]}
                    numberOfLines={2}
                  >
                    {option.label}
                  </Text>
                  {isSelected ? <Text style={{ color: c.primary, fontWeight: '700' }}>✓</Text> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {error ? <Text style={{ fontSize: 12, color: c.danger, fontWeight: '500' }}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600' },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  value: { fontSize: 14, flex: 1 },
  dropdown: {
    position: 'absolute',
    top: 72,
    left: 0,
    right: 0,
    zIndex: 50,
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  options: { maxHeight: 240 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  optionLabel: { fontSize: 14, flex: 1 },
});
