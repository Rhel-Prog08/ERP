import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { toApiError } from '../../services/apiClient';
import { authService } from '../../services/authService';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { EMAIL_RE } from '../../utils/validators';

/** Pantalla para solicitar el restablecimiento de contraseña (POST /auth/forgot-password).
 *
 * El backend responde SIEMPRE con un mensaje genérico, independientemente de
 * si el correo existe o la cuenta está activa, para evitar enumerar usuarios.
 */
export default function SolicitarRecuperarScreen() {
  const theme = useTheme();
  const c = theme.colors;
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string }>({});

  const submit = async () => {
    setFormError(null);
    setFieldErrors({});
    const mail = email.trim().toLowerCase();
    if (!mail) {
      setFieldErrors({ email: 'Introduce tu correo electrónico' });
      return;
    }
    if (!EMAIL_RE.test(mail)) {
      setFieldErrors({ email: 'El correo no tiene un formato válido' });
      return;
    }
    setSending(true);
    try {
      await authService.forgotPassword(mail);
      // Respuesta genérica: no afirmamos que el correo exista ni que se envió.
      setSent(true);
    } catch (err) {
      setFormError(toApiError(err).message || 'No se pudo solicitar el restablecimiento. Inténtalo de nuevo.');
    } finally {
      setSending(false);
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

              <Text style={[styles.title, { color: c.text }]}>
                Restablecer mi contraseña
              </Text>

              {sent ? (
                <>
                  <View style={[styles.okBox, { backgroundColor: c.successBg }]}>
                    <Text style={{ color: c.success, fontSize: 14, fontWeight: '700' }}>
                      Solicitud recibida
                    </Text>
                    <Text style={{ color: c.text, fontSize: 13, lineHeight: 19, marginTop: 6 }}>
                      Si el correo pertenece a una cuenta activa, recibirás un mensaje con el
                      enlace de restablecimiento. Revisa también la carpeta de spam.
                    </Text>
                  </View>
                  <Button title="Volver al inicio de sesión" onPress={() => router.replace('/login')} />
                </>
              ) : (
                <>
                  {formError ? (
                    <View style={[styles.errorBox, { backgroundColor: c.dangerBg }]}>
                      <Text style={{ color: c.danger, fontSize: 13, fontWeight: '600' }}>
                        {formError}
                      </Text>
                    </View>
                  ) : null}

                  <Text style={[styles.hint, { color: c.textMuted }]}>
                    Introduce el correo electrónico de tu cuenta. Recibirás un enlace para
                    crear una contraseña nueva.
                  </Text>

                  <Input
                    label="Correo electrónico"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    placeholder="tu.empresa@correo.com"
                    error={fieldErrors.email}
                    editable={!sending}
                  />

                  <Button
                    title="Solicitar restablecimiento"
                    onPress={() => void submit()}
                    loading={sending}
                    disabled={sending}
                  />

                  <Button
                    title="Volver al inicio de sesión"
                    variant="ghost"
                    disabled={sending}
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
