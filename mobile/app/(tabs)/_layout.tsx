// app/(tabs)/_layout.tsx
// Pestañas de la app. Cambian según el rol:
// - Pasajero: Viajes, Mis reservas, Emergencia
// - Conductor: Mis viajes, Solicitudes, Validar QR, Emergencia
import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, Tabs } from 'expo-router';
import { Colores } from '@/constants/colores';
import { useSesion } from '@/servicios/sesion';

type NombreIcono = keyof typeof Ionicons.glyphMap;

function icono(nombre: NombreIcono) {
  const Icono = ({ color, size }: { color: string; size: number }) => (
    <Ionicons name={nombre} color={color} size={size} />
  );
  return Icono;
}

export default function TabLayout() {
  const { usuario } = useSesion();

  // Sin sesión no se puede entrar: se va a la pantalla de ingreso.
  if (!usuario) {
    return <Redirect href="/ingreso" />;
  }
  const esConductor = usuario.rol === 'conductor';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colores.azul,
        tabBarInactiveTintColor: Colores.textoSuave,
        tabBarStyle: { backgroundColor: Colores.blanco, borderTopColor: Colores.borde },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: esConductor ? 'Mis viajes' : 'Viajes',
          tabBarIcon: icono(esConductor ? 'car-outline' : 'search-outline'),
        }}
      />
      <Tabs.Screen
        name="reservas"
        options={{
          title: 'Mis reservas',
          tabBarIcon: icono('qr-code-outline'),
          href: esConductor ? null : undefined,
        }}
      />
      <Tabs.Screen
        name="solicitudes"
        options={{
          title: 'Solicitudes',
          tabBarIcon: icono('people-outline'),
          href: esConductor ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="validar"
        options={{
          title: 'Validar QR',
          tabBarIcon: icono('scan-outline'),
          href: esConductor ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="emergencia"
        options={{ title: 'Emergencia', tabBarIcon: icono('shield-checkmark-outline') }}
      />
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
  );
}
