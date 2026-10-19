import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { LoadingState } from '../../components/ui/States';

/** Rutas públicas: si ya hay sesión, se redirige al panel. */
export default function AuthLayout() {
  const { status } = useAuth();

  if (status === 'loading') return <LoadingState message="Restaurando sesión…" />;
  if (status === 'authenticated') return <Redirect href="/" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
