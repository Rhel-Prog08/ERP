import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Almacenamiento seguro POR ENTORNO:
 * - Nativo (iOS/Android): Keychain / Keystore vía expo-secure-store.
 * - Web: localStorage del navegador (SecureStore no soporta web). Es el
 *   almacenamiento seguro estándar para una SPA; los tokens viven en memoria
 *   de sesión y no se comparten entre orígenes.
 * Si localStorage falla (modo privado), se degrada a memoria volátil para no
 * romper el login en la sesión actual.
 */

const memoryFallback = new Map<string, string>();

const canUseLocalStorage = (): boolean => {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
};

export const secureStorage = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      if (!canUseLocalStorage()) return memoryFallback.get(key) ?? null;
      try {
        return window.localStorage.getItem(key);
      } catch {
        return memoryFallback.get(key) ?? null;
      }
    }
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },

  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      memoryFallback.set(key, value);
      if (!canUseLocalStorage()) return;
      try {
        window.localStorage.setItem(key, value);
      } catch {
        // Memoria ya guardada arriba.
      }
      return;
    }
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // Sin almacenamiento persistente: la sesión durará esta ejecución.
      memoryFallback.set(key, value);
    }
  },

  async remove(key: string): Promise<void> {
    memoryFallback.delete(key);
    if (Platform.OS === 'web') {
      if (!canUseLocalStorage()) return;
      try {
        window.localStorage.removeItem(key);
      } catch {
        // Nada que hacer.
      }
      return;
    }
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // Nada que hacer.
    }
  },
};

/** Claves de persistencia (prefijo del proyecto). */
export const STORAGE_KEYS = {
  accessToken: 'codeevo.accessToken',
  refreshToken: 'codeevo.refreshToken',
  theme: 'codeevo.theme',
} as const;
