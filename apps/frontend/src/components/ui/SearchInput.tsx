import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/** Búsqueda de listado (debounce en el consumidor si hace falta). */
export function SearchInput({ value, onChange, placeholder = 'Buscar…' }: SearchInputProps) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <View style={[styles.wrap, { backgroundColor: c.card, borderColor: c.border }]}>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={c.textLight}
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.input, { color: c.text }]}
        accessibilityLabel="Campo de búsqueda"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    minWidth: 200,
    flex: 1,
  },
  input: { flex: 1, paddingVertical: 9, fontSize: 14 },
});
