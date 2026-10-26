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
import { useTheme } from '../context/ThemeContext';
import { toApiError } from '../services/apiClient';
import { authService } from '../services/authService';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { EMAIL_RE } from '../utils/validators';

type Phase = 'idle' | 'verifying' | 'done' | 'error';

/** Red con tope: una petición colgada NUNCA deja la pantalla sin feedback. */
function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

const VERIFY_TIMEOUT_MS = 15000;
const VERIFY_TIMEOUT_MSG =
  'La verificación está tardando demasiado. Comprueba tu conexión y vuelve a pulsar el botón.';

/**
 * Página pública de verificación de correo (${APP_URL}/verificar?token=...).
 * El token se envía sólo al pulsar "Verificar" (botón explícito): los
 * escáneres de correo que previsualizan enlaces NO consumen el token de un
 * solo uso. Caducidad 30 min; reutilización rechazada por el backend.
 */
export default function VerificarScreen() {
  const theme = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const token = typeof params.token === 'string' ? params.token : '';

  const [phase, setPhase] = useState<Phase>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resendEmail, setResendEmail] = useState('');
  const [resendError, setResendError] = useState<string | undefined>(undefined);
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle');

  const verify = async () => {
    setPhase('verifying');
    setErrorMsg(null);
    try {
      await withTimeout(authService.verifyEmail(token), VERIFY_TIMEOUT_MS, VERIFY_TIMEOUT_MSG);
      setPhase('done');
    } catch (err) {
      const apiError = toApiError(err);
      setErrorMsg(apiError.message || 'No se pudo verificar el enlace. Inténtalo de nuevo.');
      setPhase('error');
    }
  };

  const resend = async () => {
    setResendError(undefined);
    const mail = resendEmail.trim().toLowerCase();
    if (!mail || !EMAIL_RE.test(mail)) {
      setResendError('Introduce un correo válido');
      return;
    }
    setResendState('sending');
    try {
      await authService.resendVerification(mail);
      setResendState('sent');
    } catch (err) {
      setResendState('idle');
      setResendError(toApiError(err).message);
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
              <Text style={[styles.title, { color: c.text }]}>Verificación de correo</Text>

              {phase === 'done' ? (
                <>
                  <View style={[styles.okBox, { backgroundColor: c.successBg }]}>
                    <Text style={{ color: c.success, fontSize: 14, fontWeight: '700' }}>
                      Correo verificado correctamente
                    </Text>
                    <Text style={{ color: c.text, fontSize: 13, lineHeight: 19, marginTop: 6 }}>
                      Tu cuenta ya está activa. Puedes iniciar sesión con tu correo y contraseña.
                    </Text>
                  </View>
                  <Button title="Ir a iniciar sesión" onPress={() => router.replace('/login')} />
                </>
              ) : (
                <>
                  {errorMsg ? (
                    <View style={[styles.errorBox, { backgroundColor: c.dangerBg }]}>
                      <Text style={{ color: c.danger, fontSize: 13, fontWeight: '600' }}>
                        {errorMsg}
                      </Text>
                      {errorMsg.includes('no es válido') ? (
                        <Text style={{ color: c.text, fontSize: 12, lineHeight: 17, marginTop: 6 }}>
                          Si tienes varios correos de CodeEvo, usa el enlace del ÚLTIMO: cada
                          reenvío deja sin efecto los anteriores.
                        </Text>
                      ) : null}
                    </View>
                  ) : null}

                  {token ? (
                    <Text style={{ color: c.textMuted, fontSize: 13, lineHeight: 19 }}>
                      Pulsa el botón para confirmar que este correo es tuyo. El enlace caduca a los
                      30 minutos y sólo puede usarse una vez.
                    </Text>
                  ) : (
                    <Text style={{ color: c.danger, fontSize: 13, lineHeight: 19 }}>
                      El enlace no incluye un código de verificación. Abre el enlace tal y como
                      llegó a tu correo (o solicita un reenvío más abajo).
                    </Text>
                  )}

                  {token ? (
                    resendState === 'sent' ? (
                      <View style={[styles.errorBox, { backgroundColor: c.dangerBg }]}>
                        <Text style={{ color: c.text, fontSize: 13, lineHeight: 19 }}>
                          Solicitaste un enlace nuevo, así que el enlace de esta página ya no
                          vale. Abre el correo MÁS RECIENTE y pulsa «Verificar mi correo» desde
                          ese correo.
                        </Text>
                      </View>
                    ) : (
                      <Button
                        title={phase === 'verifying' ? 'Verificando…' : 'Verificar mi correo'}
                        onPress={() => void verify()}
                        loading={phase === 'verifying'}
                        disabled={phase === 'verifying'}
                      />
                    )
                  ) : null}

                  {/* Reenvío manual (también accesible tras caducar el enlace). */}
                  <View style={[styles.resendBox, { borderColor: c.border }]}>
                    <Text style={{ color: c.text, fontSize: 13, fontWeight: '600' }}>
                      ¿Necesitas un enlace nuevo?
                    </Text>
                    <Input
                      label="Correo electrónico"
                      value={resendEmail}
                      onChangeText={setResendEmail}
                      error={resendError}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                      placeholder="tu.empresa@correo.com"
                      editable={resendState !== 'sending'}
                    />
                    <Button
                      title={
                        resendState === 'sent'
                          ? 'Solicitud enviada'
                          : resendState === 'sending'
                            ? 'Enviando…'
                            : 'Reenviar correo de verificación'
                      }
                      variant="secondary"
                      disabled={resendState === 'sending'}
                      onPress={() => void resend()}
                    />
                    {resendState === 'sent' ? (
                      <Text style={{ color: c.textMuted, fontSize: 12, lineHeight: 17 }}>
                        Si el correo pertenece a una cuenta pendiente, recibirás el mensaje en unos
                        minutos (máximo un reenvío cada 2 minutos, por seguridad). Revisa la
                        carpeta de spam.
                      </Text>
                    ) : null}
                  </View>

                  <Button
                    title="Volver al inicio de sesión"
                    variant="ghost"
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
  title: { fontSize: 20, fontWeight: '800' },
  errorBox: { borderRadius: 10, padding: 12 },
  okBox: { borderRadius: 10, padding: 14 },
  resendBox: { borderWidth: 1, borderRadius: 10, padding: 14, gap: 12 },
});
