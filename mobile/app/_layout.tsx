// app/_layout.tsx
// Raíz de la app: comparte la sesión con todas las pantallas.
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ProveedorSesion } from '@/servicios/sesion';

export default function RootLayout() {
  return (
    <ProveedorSesion>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="ingreso" />
        <Stack.Screen name="verificar" />
      </Stack>
      <StatusBar style="dark" />
    </ProveedorSesion>
  );
}
