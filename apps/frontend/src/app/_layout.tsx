import React, { useMemo } from 'react';
import {
  Stack,
  // En SDK 57 expo-router vendea react-navigation: el ThemeProvider del paquete
  // npm '@react-navigation/native' sería OTRA copia del contexto y no llegaría
  // a las escenas. Hay que usar el que exporta expo-router.
  ThemeProvider as NavThemeProvider,
  DefaultTheme as NavDefaultTheme,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';

function RootNavigator() {
  const theme = useTheme();

  // React Navigation pinta el fondo de cada escena con SU tema por defecto
  // (#f2f2f2): hay que inyectar la paleta CodeEvo o el contenido queda en gris.
  const navTheme = useMemo(
    () => ({
      ...NavDefaultTheme,
      colors: {
        ...NavDefaultTheme.colors,
        primary: theme.colors.primary,
        background: theme.colors.bg,
        card: theme.colors.card,
        text: theme.colors.text,
        border: theme.colors.border,
      },
    }),
    [theme]
  );

  return (
    <NavThemeProvider value={navTheme}>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.bg },
        }}
      />
    </NavThemeProvider>
  );
}

/** Layout raíz: proveedores globales + navegación Expo Router. */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <RootNavigator />
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
