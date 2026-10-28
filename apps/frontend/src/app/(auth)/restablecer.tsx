import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { toApiError } from '../../services/apiClient';
import { authService } from '../../services/authService';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

/** Pantalla para establecer una nueva contraseña usando el token de un solo uso
 *  recibido por correo (POST /auth/reset-password).
 *
 * El token se valida en el backend: hash, vencimiento y uso único.
 * Tras el restablecimiento exitoso, todas las sesiones se cierran y se invita
 * al usuario a iniciar sesión de nuevo.
 */
export default function RestablecerScreen() {
  const theme = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const token = typeof params.token === 'string' ? params.token : '';

  const [newPassword, setNewPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [resetting, setResetting] = useState(false);
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    newPassword?: string;
    passwordConfirm?: string;
  }>({});

  const submit = async () => {
    setFormError(null);
    setFieldErrors({});
    if (!newPassword) {
      setFieldErrors({ newPassword: 'Introduce tu nueva contraseña' });
      return;
    }
    if (newPassword.length < 8) {
      setFieldErrors({ newPassword: 'Mínimo 8 caracteres' });
      return;
    }
    if (!/[a-zA-Z]/.test(newPassword)) {
      setFieldErrors({ newPassword: 'Debe contener al menos una letra' });
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      setFieldErrors({ newPassword: 'Debe contener al menos un número' });
      return;
    }
    if (newPassword !== passwordConfirm) {
      setFieldErrors({
        newPassword: 'Las contraseñas no coinciden',
        passwordConfirm: 'Las contraseñas no coinciden',
      });
      return;
    }

    setResetting(true);
    try {
      await authService.resetPassword(token, newPassword);
      setDone(true);
    } catch (err) {
      const apiError = toApiError(err);
      setFormError(apiError.message || 'No se pudo restablecer la contraseña. Inténtalo de nuevo.');
    } finally {
      setResetting(false);
    }
  };

  if (!token) {
    return (
      <View style={[styles.root, { backgroundColor: '#0f172a' }]}>
        <SafeAreaView style={styles.root}>
          <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
              <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border, ...theme.shadow }]}>
                <Text style={[styles.title, { color: c.text }]}>Enlace no válido</Text>
                <Text style={[styles.hint, { color: c.textMuted }]}>
                  El enlace de restablecimiento no incluye un código de acceso. Solicita uno nuevo
                  desde la pantalla de inicio de sesión.
                </Text>
                <Button title="Ir a iniciar sesión" onPress={() => router.replace('/login')} />
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: '#0f172a' }]}>
      <SafeAreaView style={styles.root}>
        <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border, ...theme.shadow }]}>
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

              {done ? (
                <>
                  <Text style={[styles.title, { color: c.text }]}>
                    Contraseña actualizada
                  </Text>
                  <View style={[styles.okBox, { backgroundColor: c.successBg }]}>
                    <Text style={{ color: c.success, fontSize: 14, fontWeight: '700' }}>
                      Listo
                    </Text>
                    <Text style={{ color: c.text, fontSize: 13, lineHeight: 19, marginTop: 6 }}>
                      Tu contraseña se ha actualizado correctamente. Todas las sesiones previas se
                      han cerrado. Inicia sesión con tu nueva contraseña.
                    </Text>
                  </View>
                  <Button title="Iniciar sesión" onPress={() => router.replace('/login')} />
                </>
              ) : (
                <>
                  <Text style={[styles.title, { color: c.text }]}>
                    Nueva contraseña
                  </Text>

                  {formError ? (
                    <View style={[styles.errorBox, { backgroundColor: c.dangerBg }]}>
                      <Text style={{ color: c.danger, fontSize: 13, fontWeight: '600' }}>
                        {formError}
                      </Text>
                    </View>
                  ) : null}

                  <Text style={[styles.hint, { color: c.textMuted }]}>
                    Crea una contraseña nueva (mínimo 8 caracteres, al menos una letra y un número).
                  </Text>

                  <Input
                    label="Nueva contraseña"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry
                    autoComplete="new-password"
                    placeholder="••••••••"
                    error={fieldErrors.newPassword}
                    editable={!resetting}
                  />

                  <Input
                    label="Confirmar contraseña"
                    value={passwordConfirm}
                    onChangeText={setPasswordConfirm}
                    secureTextEntry
                    autoComplete="new-password"
                    placeholder="••••••••"
                    error={fieldErrors.passwordConfirm}
                    editable={!resetting}
                  />

                  <Button
                    title="Restablecer contraseña"
                    onPress={() => void submit()}
                    loading={resetting}
                    disabled={resetting}
                  />

                  <Button
                    title="Volver al inicio de sesión"
                    variant="ghost"
                    disabled={resetting}
                    onPress={() => router.replace('/login')}
                  />
                </>
              )}
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
  title: { fontSize: 20, fontWeight: '800', color: '#000000' },
  hint: { fontSize: 13, textAlign: 'center', lineHeight: 18, marginBottom: 12 },
  errorBox: { borderRadius: 10, padding: 12 },
  okBox: { borderRadius: 10, padding: 14 },
});
