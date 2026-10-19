// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    rules: {
      // Carga de datos sin librería de datos (TanStack Query, React `use`...):
      // el estado de "cargando" se activa al inicio del effect y se resuelve
      // en callbacks asíncronos. Patrón estándar en apps Expo; se mantiene
      // visible como AVISO en lugar de error para no perdrelo de vista.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);
