// app/ingreso.tsx
// Paso 1 del ingreso: nombre, correo institucional y rol. El backend envía un código al correo.
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Aviso, Boton, Campo, Opciones, Pantalla } from '@/components/wheels/ui';
import { Colores } from '@/constants/colores';
import { Rol, solicitarCodigo } from '@/servicios/api';

export default function Ingreso() {
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [rol, setRol] = useState<Rol>('pasajero');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const enviar = async () => {
    setError('');
    setCargando(true);
    try {
      await solicitarCodigo(nombre, correo, rol);
      router.push({ pathname: '/verificar', params: { correo: correo.trim().toLowerCase() } });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <Pantalla fija>
      <View style={estilos.marca}>
        <Image source={require('@/assets/images/logo.png')} style={estilos.logo} />
        <Text style={estilos.nombreApp}>WHEELS</Text>
        <Text style={estilos.lema}>Viajes compartidos entre estudiantes de La Sabana</Text>
      </View>

      <Campo etiqueta="Nombre" value={nombre} onChangeText={setNombre} />
      <Campo
        etiqueta="Correo institucional"
        value={correo}
        onChangeText={setCorreo}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <Text style={estilos.etiqueta}>Voy a usar WHEELS como</Text>
      <Opciones
        opciones={[
          { valor: 'pasajero', texto: 'Pasajero' },
          { valor: 'conductor', texto: 'Conductor' },
        ]}
        valor={rol}
        onCambio={setRol}
      />

      {error ? <Aviso tipo="error" texto={error} /> : null}
      <Boton texto="Enviar código" onPress={enviar} cargando={cargando} />
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  marca: { alignItems: 'center', gap: 2, marginBottom: 6 },
  logo: { width: 68, height: 68, borderRadius: 16 },
  lema: { fontSize: 14, color: Colores.textoSuave, textAlign: 'center' },
  nombreApp: { fontSize: 26, fontWeight: '800', color: Colores.azulOscuro, letterSpacing: 2 },
  etiqueta: { fontSize: 14, color: Colores.texto, fontWeight: '600' },
});
