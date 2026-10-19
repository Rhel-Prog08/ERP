import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';

interface InputProps extends Omit<TextInputProps, 'style'> {
  label: string;
  /** Mensaje de validación (lo pinta en rojo bajo el campo). */
  error?: string;
  hint?: string;
  containerStyle?: React.ComponentProps<typeof View>['style'];
}

/** Campo de texto con etiqueta, error y modo seguro con botón de ojo. */
export function Input({ label, error, hint, secureTextEntry, containerStyle, ...rest }: InputProps) {
  const theme = useTheme();
  const c = theme.colors;
  const [hidden, setHidden] = useState(Boolean(secureTextEntry));

  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={[styles.label, { color: c.text }]}>{label}</Text>
      <View
        style={[
          styles.inputWrap,
          {
            borderColor: error ? c.danger : c.border,
            backgroundColor: c.card,
          },
        ]}
      >
        <TextInput
          {...rest}
          secureTextEntry={hidden}
          placeholderTextColor={c.textLight}
          style={[styles.input, { color: c.text }]}
        />
        {secureTextEntry ? (
          <Pressable
            onPress={() => setHidden((v) => !v)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Mostrar contraseña' : 'Ocultar contraseña'}
          >
            <Text style={{ fontSize: 13, color: c.textMuted, fontWeight: '600' }}>
              {hidden ? 'Ver' : 'Ocultar'}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text style={[styles.error, { color: c.danger }]}>{error}</Text>
      ) : hint ? (
        <Text style={[styles.hint, { color: c.textMuted }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  input: { flex: 1, paddingVertical: 11, fontSize: 14 },
  error: { fontSize: 12, fontWeight: '500' },
  hint: { fontSize: 12 },
});
