import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { toApiError } from '../../services/apiClient';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

/** Pantalla de acceso: POST /api/v1/auth/login (email + contraseña). */
export default function LoginScreen() {
  const theme = useTheme();
  const c = theme.colors;
  const { login, pending } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const submit = async () => {
    setFormError(null);
    setFieldErrors({});
    if (!email.trim() || !password) {
      setFieldErrors({
        email: !email.trim() ? 'Introduce tu correo electrónico' : undefined,
        password: !password ? 'Introduce tu contraseña' : undefined,
      });
      return;
    }
    try {
      await login(email.trim(), password);
      // La redacción la hace (auth)/_layout al pasar a 'authenticated'.
    } catch (err) {
      const apiError = toApiError(err);
      setFormError(apiError.message);
      setFieldErrors({
        email: apiError.fieldError('email'),
        password: apiError.fieldError('password'),
      });
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: '#0f172a' }]}>
      <SafeAreaView style={styles.root}>
        <KeyboardAvoidingView
          style={styles.root}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View
              style={[
                styles.card,
                { backgroundColor: c.card, borderColor: c.border },
                theme.shadow,
              ]}
            >
              {/* Marca */}
              <View style={styles.brandRow}>
                <View style={[styles.mark, { backgroundColor: c.primary }]}>
                  <Text style={styles.markText}>C</Text>
                </View>
                <View>
                  <Text style={[styles.brand, { color: c.text }]}>CodeEvo ERP</Text>
                  <Text style={[styles.brandSub, { color: c.textMuted }]}>
                    Gestión empresarial
                  </Text>
                </View>
              </View>

              {formError ? (
                <View style={[styles.errorBox, { backgroundColor: c.dangerBg }]}>
                  <Text style={{ color: c.danger, fontSize: 13, fontWeight: '600' }}>
                    {formError}
                  </Text>
                </View>
              ) : null}

              <Input
                label="Correo electrónico"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                placeholder="tu.empresa@correo.com"
                error={fieldErrors.email}
                editable={!pending}
              />
              <Input
                label="Contraseña"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password"
                placeholder="••••••••"
                error={fieldErrors.password}
                editable={!pending}
              />

              <Button
                title="Iniciar sesión"
                onPress={() => void submit()}
                loading={pending}
                disabled={pending}
              />

              <Text style={[styles.footer, { color: c.textLight }]}>
                Acceso gestionado por tu empresa. Los permisos de cada módulo los define tu rol.
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: 16,
    padding: 26,
    gap: 16,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  mark: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  markText: { color: '#ffffff', fontSize: 24, fontWeight: '800' },
  brand: { fontSize: 20, fontWeight: '800' },
  brandSub: { fontSize: 13 },
  errorBox: { borderRadius: 10, padding: 12 },
  footer: { fontSize: 12, textAlign: 'center', lineHeight: 17 },
});
