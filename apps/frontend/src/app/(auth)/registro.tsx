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
import { EMAIL_RE } from '../../utils/validators';

const PASSWORD_MIN = 8;

type Phase = 'form' | 'success';

/**
 * Registro público CONTROLADO (FASE 3): sólo con invitación previa de un
 * administrador. La invitación fija correo, empresa y rol (no se puede
 * autoasignar privilegios). El backend exige además REGISTRATION_ENABLED
 * con proveedor de correo real configurado (503 si no).
 */
export default function RegistroScreen() {
  const theme = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const inviteFromLink = typeof params.token === 'string' ? params.token : '';

  const [phase, setPhase] = useState<Phase>('form');
  const [inviteToken, setInviteToken] = useState(inviteFromLink);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});
  const [saving, setSaving] = useState(false);
  const [sentEmail, setSentEmail] = useState('');
  const [emailSent, setEmailSent] = useState(true);
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle');

  const validate = (): boolean => {
    const errors: Record<string, string | undefined> = {};
    if (!inviteToken.trim()) errors.inviteToken = 'Introduce el código de invitación';
    if (!firstName.trim()) errors.firstName = 'Introduce tu nombre';
    else if (firstName.trim().length > 60) errors.firstName = 'Máximo 60 caracteres';
    if (!lastName.trim()) errors.lastName = 'Introduce tus apellidos';
    else if (lastName.trim().length > 60) errors.lastName = 'Máximo 60 caracteres';
    const mail = email.trim().toLowerCase();
    if (!mail) errors.email = 'Introduce tu correo electrónico';
    else if (!EMAIL_RE.test(mail)) errors.email = 'El correo no tiene un formato válido';
    if (!password) errors.password = 'Introduce una contraseña';
    else if (password.length < PASSWORD_MIN) {
      errors.password = `Mínimo ${PASSWORD_MIN} caracteres`;
    } else if (!/[a-zA-ZáéíóúñÁÉÍÓÚÑ]/.test(password)) {
      errors.password = 'Debe contener al menos una letra';
    } else if (!/[0-9]/.test(password)) {
      errors.password = 'Debe contener al menos un número';
    }
    if (passwordConfirm !== password) {
      errors.passwordConfirm = 'Las contraseñas no coinciden';
    }
    setFieldErrors(errors);
    return Object.values(errors).every((e) => !e);
  };

  const submit = async () => {
    setFormError(null);
    if (!validate()) return;
    setSaving(true);
    try {
      const data = await authService.register({
        inviteToken: inviteToken.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        password,
        passwordConfirm,
      });
      setSentEmail(email.trim().toLowerCase());
      setEmailSent(data.emailSent);
      setPhase('success');
    } catch (err) {
      const apiError = toApiError(err);
      setFormError(apiError.message);
      setFieldErrors({
        inviteToken: apiError.fieldError('inviteToken'),
        firstName: apiError.fieldError('firstName'),
        lastName: apiError.fieldError('lastName'),
        email: apiError.fieldError('email'),
        password: apiError.fieldError('password'),
        passwordConfirm: apiError.fieldError('passwordConfirm'),
      });
    } finally {
      setSaving(false);
    }
  };

  const resend = async () => {
    setResendState('sending');
    try {
      await authService.resendVerification(sentEmail);
      setResendState('sent');
    } catch {
      setResendState('idle');
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
              <View style={styles.brandRow}>
                <View style={[styles.mark, { backgroundColor: c.primary }]}>
                  <Text style={styles.markText}>C</Text>
                </View>
                <View>
                  <Text style={[styles.brand, { color: c.text }]}>Crear cuenta</Text>
                  <Text style={[styles.brandSub, { color: c.textMuted }]}>
                    Sólo posible con invitación
                  </Text>
                </View>
              </View>

              {phase === 'success' ? (
                <>
                  <View style={[styles.okBox, { backgroundColor: c.successBg }]}>
                    <Text style={{ color: c.success, fontSize: 14, fontWeight: '700' }}>
                      Cuenta creada
                    </Text>
                    <Text style={{ color: c.text, fontSize: 13, lineHeight: 19, marginTop: 6 }}>
                      {emailSent
                        ? 'Hemos enviado un correo de verificación a tu dirección. Abre el enlace (caduca en 30 minutos) antes de iniciar sesión.'
                        : 'La cuenta se creó, pero el correo de verificación no pudo enviarse. Puedes solicitar el reenvío.'}
                    </Text>
                  </View>

                  {resendState === 'sent' ? (
                    <Text style={{ color: c.textMuted, fontSize: 13 }}>
                      Si tu cuenta sigue pendiente, recibirás el correo en unos minutos. Revisa la
                      carpeta de spam.
                    </Text>
                  ) : (
                    <Button
                      title={
                        resendState === 'sending' ? 'Enviando…' : 'Reenviar correo de verificación'
                      }
                      variant="secondary"
                      disabled={resendState !== 'idle'}
                      onPress={() => void resend()}
                    />
                  )}

                  <Button title="Ir a iniciar sesión" onPress={() => router.replace('/login')} />
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

                  <Input
                    label="Código de invitación"
                    value={inviteToken}
                    onChangeText={setInviteToken}
                    error={fieldErrors.inviteToken}
                    autoCapitalize="none"
                    autoComplete="off"
                    placeholder="Pégalo aquí o usa el enlace del correo"
                    hint="Lo envía un administrador de tu empresa"
                    editable={!saving}
                  />
                  <Input
                    label="Nombre"
                    value={firstName}
                    onChangeText={setFirstName}
                    error={fieldErrors.firstName}
                    placeholder="Nombre"
                    maxLength={60}
                    editable={!saving}
                  />
                  <Input
                    label="Apellidos"
                    value={lastName}
                    onChangeText={setLastName}
                    error={fieldErrors.lastName}
                    placeholder="Apellidos"
                    maxLength={60}
                    editable={!saving}
                  />
                  <Input
                    label="Correo electrónico"
                    value={email}
                    onChangeText={setEmail}
                    error={fieldErrors.email}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    placeholder="tu.empresa@correo.com"
                    editable={!saving}
                  />
                  <Input
                    label="Contraseña"
                    value={password}
                    onChangeText={setPassword}
                    error={fieldErrors.password}
                    secureTextEntry
                    autoComplete="new-password"
                    hint={`Mínimo ${PASSWORD_MIN} caracteres, con letra y número`}
                    placeholder="••••••••"
                    editable={!saving}
                  />
                  <Input
                    label="Confirmar contraseña"
                    value={passwordConfirm}
                    onChangeText={setPasswordConfirm}
                    error={fieldErrors.passwordConfirm}
                    secureTextEntry
                    autoComplete="new-password"
                    placeholder="••••••••"
                    editable={!saving}
                  />

                  <Button
                    title="Crear cuenta"
                    onPress={() => void submit()}
                    loading={saving}
                    disabled={saving}
                  />
                  <Button
                    title="Volver al inicio de sesión"
                    variant="ghost"
                    disabled={saving}
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
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  card: {
    width: '100%',
    maxWidth: 460,
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
  okBox: { borderRadius: 10, padding: 14 },
});
