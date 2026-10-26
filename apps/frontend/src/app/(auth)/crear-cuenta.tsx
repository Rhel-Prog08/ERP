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
import { validateEmail } from '../../utils/validators';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

/**
 * Registro público MULTIEMPRESA: crea una empresa nueva y a su
 * administrador (POST /auth/register-company). Tras el alta se muestra una
 * pantalla informativa: la cuenta queda PENDIENTE de verificar el correo y
 * no se puede iniciar sesión hasta completar la verificación.
 *
 * El formulario sólo envía datos propios (empresa y persona): empresa, rol,
 * permisos y estado los asigna SIEMPRE el servidor.
 */
type FieldErrors = Partial<
  Record<'companyName' | 'fullName' | 'email' | 'password' | 'passwordConfirm', string>
>;

interface SignupResult {
  company: { id: string; name: string };
  user: { id: string; firstName: string; lastName: string; email: string };
  emailSent: boolean;
  message: string;
}

/** Espejo de la regla del backend (utils/password.js): 8+, letra y número. */
function passwordIssue(value: string): string | undefined {
  if (value.length < 8) return 'Mínimo 8 caracteres';
  if (!/[a-zA-Z]/.test(value)) return 'Debe contener al menos una letra';
  if (!/[0-9]/.test(value)) return 'Debe contener al menos un número';
  return undefined;
}

export default function CrearCuentaScreen() {
  const theme = useTheme();
  const c = theme.colors;
  const router = useRouter();

  const [companyName, setCompanyName] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');

  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [result, setResult] = useState<SignupResult | null>(null);

  // Reenvío del correo de verificación desde la pantalla informativa.
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle');

  const validate = (): { ok: boolean; firstName?: string; lastName?: string } => {
    const errors: FieldErrors = {};

    if (!companyName.trim()) errors.companyName = 'Introduce el nombre de la empresa';
    else if (companyName.trim().length < 2) errors.companyName = 'Mínimo 2 caracteres';
    else if (companyName.trim().length > 120) errors.companyName = 'Máximo 120 caracteres';

    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (!fullName.trim()) errors.fullName = 'Introduce tu nombre completo';
    else if (parts.length < 2) {
      errors.fullName = 'Introduce nombre y apellido del administrador';
    }

    const emailError = validateEmail(email.trim(), { required: true });
    if (emailError) errors.email = emailError;

    const passwordIssueMsg = passwordIssue(password);
    if (!password) errors.password = 'Introduce una contraseña';
    else if (passwordIssueMsg) errors.password = passwordIssueMsg;

    if (!passwordConfirm) errors.passwordConfirm = 'Confirma tu contraseña';
    else if (password !== passwordConfirm) errors.passwordConfirm = 'Las contraseñas no coinciden';

    setFieldErrors(errors);
    return {
      ok: Object.keys(errors).length === 0,
      firstName: parts[0],
      lastName: parts.slice(1).join(' '),
    };
  };

  const submit = async () => {
    setFormError(null);
    const check = validate();
    if (!check.ok || !check.firstName || !check.lastName) return;

    setCreating(true);
    try {
      const data = await authService.registerCompany({
        companyName: companyName.trim(),
        firstName: check.firstName,
        lastName: check.lastName,
        email: email.trim(),
        password,
        passwordConfirm,
      });
      setResult(data);
    } catch (err) {
      const apiError = toApiError(err);
      setFormError(apiError.message);
      const firstNameErr = apiError.fieldError('firstName');
      const lastNameErr = apiError.fieldError('lastName');
      setFieldErrors({
        companyName: apiError.fieldError('companyName'),
        fullName: firstNameErr || lastNameErr,
        email: apiError.fieldError('email'),
        password: apiError.fieldError('password'),
        passwordConfirm: apiError.fieldError('passwordConfirm'),
      });
    } finally {
      setCreating(false);
    }
  };

  const resend = async () => {
    setResendState('sending');
    try {
      await authService.resendVerification(email.trim());
      setResendState('sent');
    } catch {
      setResendState('idle');
      setFormError('No se pudo solicitar el reenvío. Inténtalo de nuevo en unos minutos.');
    }
  };

  /* ---------------------- Pantalla informativa (éxito) ---------------------- */
  if (result) {
    return (
      <View style={[styles.root, { backgroundColor: '#0f172a' }]}>
        <SafeAreaView style={styles.root}>
          <KeyboardAvoidingView
            style={styles.root}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
              <View
                style={[styles.card, { backgroundColor: c.card, borderColor: c.border }, theme.shadow]}
              >
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

                <Text style={[styles.title, { color: c.text }]}>Empresa creada</Text>

                <View
                  style={[
                    styles.okBox,
                    { backgroundColor: result.emailSent ? c.successBg : c.warningBg },
                  ]}
                >
                  <Text
                    style={{
                      color: result.emailSent ? c.success : c.warning,
                      fontSize: 13,
                      lineHeight: 19,
                    }}
                  >
                    {result.message}
                  </Text>
                  <Text style={{ color: c.textMuted, fontSize: 13, lineHeight: 19 }}>
                    Empresa: {result.company.name} · Correo: {result.user.email}
                  </Text>
                </View>

                <Text style={{ color: c.textMuted, fontSize: 12, lineHeight: 17 }}>
                  Hasta que verifique su correo no podrá iniciar sesión con esta cuenta. El
                  enlace de verificación caduca a los 30 minutos y puede solicitar uno nuevo.
                </Text>

                {formError ? (
                  <View style={[styles.errorBox, { backgroundColor: c.dangerBg }]}>
                    <Text style={{ color: c.danger, fontSize: 13, fontWeight: '600' }}>
                      {formError}
                    </Text>
                  </View>
                ) : null}

                <Button
                  title="Volver a Iniciar sesión"
                  onPress={() => router.replace('/login')}
                />
                <Button
                  title={
                    resendState === 'sent'
                      ? 'Reenvío solicitado'
                      : resendState === 'sending'
                        ? 'Enviando…'
                        : 'Reenviar correo de verificación'
                  }
                  variant="secondary"
                  size="sm"
                  disabled={resendState !== 'idle'}
                  onPress={() => void resend()}
                />
                {resendState === 'sent' ? (
                  <Text style={{ color: c.textMuted, fontSize: 12, lineHeight: 17 }}>
                    Si la cuenta existe y sigue pendiente, el mensaje llegará en unos minutos.
                    Revise también la carpeta de spam.
                  </Text>
                ) : null}
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    );
  }

  /* ------------------------------ Formulario ------------------------------ */
  return (
    <View style={[styles.root, { backgroundColor: '#0f172a' }]}>
      <SafeAreaView style={styles.root}>
        <KeyboardAvoidingView
          style={styles.root}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View
              style={[styles.card, { backgroundColor: c.card, borderColor: c.border }, theme.shadow]}
            >
              <View style={styles.brandRow}>
                <View style={[styles.mark, { backgroundColor: c.primary }]}>
                  <Text style={styles.markText}>C</Text>
                </View>
                <View>
                  <Text style={[styles.brand, { color: c.text }]}>CodeEvo ERP</Text>
                  <Text style={[styles.brandSub, { color: c.textMuted }]}>
                    Crear tu empresa
                  </Text>
                </View>
              </View>

              <Text style={[styles.subtitle, { color: c.textMuted }]}>
                Crea una cuenta para ti como administrador y una empresa nueva con sus permisos.
              </Text>

              {formError ? (
                <View style={[styles.errorBox, { backgroundColor: c.dangerBg }]}>
                  <Text style={{ color: c.danger, fontSize: 13, fontWeight: '600' }}>
                    {formError}
                  </Text>
                </View>
              ) : null}

              <Input
                label="Nombre de la empresa"
                value={companyName}
                onChangeText={setCompanyName}
                placeholder="Mi Empresa S.A."
                autoCapitalize="words"
                error={fieldErrors.companyName}
                editable={!creating}
              />
              <Input
                label="Nombre completo del administrador"
                value={fullName}
                onChangeText={setFullName}
                placeholder="Escribe tu nombre completo"
                autoCapitalize="words"
                error={fieldErrors.fullName}
                editable={!creating}
              />
              <Input
                label="Correo electrónico"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                placeholder="tu.empresa@correo.com"
                error={fieldErrors.email}
                editable={!creating}
              />
              <Input
                label="Contraseña"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres"
                error={fieldErrors.password}
                editable={!creating}
              />
              <Input
                label="Confirmar contraseña"
                value={passwordConfirm}
                onChangeText={setPasswordConfirm}
                secureTextEntry
                autoComplete="new-password"
                placeholder="Repite tu contraseña"
                error={fieldErrors.passwordConfirm}
                editable={!creating}
              />

              <Button
                title="Crear empresa"
                onPress={() => void submit()}
                loading={creating}
                disabled={creating}
              />

              <Button
                title="Volver a Iniciar sesión"
                variant="ghost"
                disabled={creating}
                onPress={() => router.replace('/login')}
              />

              <Text style={[styles.footer, { color: c.textLight }]}>
                Al crear la cuenta recibirás un correo de verificación. Sin verificar no podrás
                iniciar sesión.
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
    maxWidth: 440,
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: 16,
    padding: 26,
    gap: 14,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  mark: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  markText: { color: '#ffffff', fontSize: 24, fontWeight: '800' },
  brand: { fontSize: 20, fontWeight: '800' },
  brandSub: { fontSize: 13 },
  subtitle: { fontSize: 13, lineHeight: 19 },
  title: { fontSize: 18, fontWeight: '800' },
  okBox: { borderRadius: 10, padding: 12, gap: 6 },
  warnBox: { borderRadius: 10, padding: 12, gap: 6 },
  errorBox: { borderRadius: 10, padding: 12 },
  footer: { fontSize: 12, textAlign: 'center', lineHeight: 17 },
});
