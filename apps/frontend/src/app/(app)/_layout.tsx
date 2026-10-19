import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { LoadingState } from '../../components/ui/States';
import { AppShell } from '../../components/layout/AppShell';

/** Rutas protegidas: exigen sesión y se muestran dentro del shell del ERP. */
export default function AppLayout() {
  const { status } = useAuth();

  if (status === 'loading') return <LoadingState message="Verificando sesión…" />;
  if (status === 'unauthenticated') return <Redirect href="/login" />;

  return (
    <AppShell>
      <Stack screenOptions={{ headerShown: false }} />
    </AppShell>
  );
}
