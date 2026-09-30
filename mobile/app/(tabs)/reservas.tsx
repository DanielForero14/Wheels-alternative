// app/(tabs)/reservas.tsx
// Pasajero: sus reservas con el código QR que muestra al subir al carro (Reto 1).
// Cuando el conductor acepta, también ve la placa y la descripción del carro.
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import TarjetaViaje from '@/components/wheels/TarjetaViaje';
import TiempoEstimado from '@/components/wheels/TiempoEstimado';
import { Aviso, Encabezado, Pantalla, TextoSuave } from '@/components/wheels/ui';
import { Colores } from '@/constants/colores';
import { misReservas, ReservaConQR } from '@/servicios/api';
import { useSesion } from '@/servicios/sesion';

export default function Reservas() {
  const { usuario } = useSesion();
  const [reservas, setReservas] = useState<ReservaConQR[]>([]);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      misReservas(usuario!.correo)
        .then(setReservas)
        .catch(e => setError((e as Error).message));
    }, [usuario])
  );

  return (
    <Pantalla>
      <Encabezado titulo="Mis reservas" subtitulo="Tus solicitudes y el código QR para subir al carro" />
      {error ? <Aviso tipo="error" texto={error} /> : null}
      {reservas.length === 0 ? <TextoSuave>Aún no tienes reservas. Busca un viaje en la pestaña Viajes.</TextoSuave> : null}

      {reservas.map(({ reserva, viaje, conductorNombre, vehiculo, imagenQR }) => (
        <TarjetaViaje key={reserva.id} viaje={{ ...viaje, conductorNombre }}>
          <Text style={estilos.recogida}>Te recogen en: {reserva.puntoRecogida || 'sin indicar'}</Text>
          <TiempoEstimado viaje={viaje} />
          {reserva.estado === 'pendiente' ? (
            <Aviso tipo="info" texto="Esperando que el conductor acepte tu solicitud. Tu código QR aparecerá aquí." />
          ) : reserva.estado === 'rechazada' ? (
            <Aviso tipo="error" texto="El conductor rechazó esta solicitud. Puedes buscar otro viaje." />
          ) : reserva.usada ? (
            <Aviso tipo="exito" texto="Ya abordaste este viaje. El código no se puede volver a usar." />
          ) : (
            <View style={estilos.qr}>
              <Aviso tipo="exito" texto="Solicitud aceptada. Muestra este código al subir al carro." />
              {vehiculo ? (
                <View style={estilos.wheels}>
                  <Text style={estilos.tituloWheels}>Tu wheels</Text>
                  <Text style={estilos.placa}>{vehiculo.placa}</Text>
                  <Text style={estilos.textoWheels}>{vehiculo.descripcion}</Text>
                  <Text style={estilos.textoWheels}>Conductor: {conductorNombre}</Text>
                </View>
              ) : null}
              <Image source={{ uri: imagenQR ?? undefined }} style={estilos.imagenQR} contentFit="contain" />
              <Text style={estilos.codigo} selectable>
                {reserva.codigo}
              </Text>
            </View>
          )}
        </TarjetaViaje>
      ))}
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  qr: { alignItems: 'center', gap: 6, paddingTop: 4 },
  imagenQR: { width: 220, height: 220 },
  codigo: { fontSize: 11, color: Colores.textoSuave, textAlign: 'center' },
  recogida: { fontSize: 14, color: Colores.texto },
  wheels: {
    alignSelf: 'stretch',
    alignItems: 'center',
    backgroundColor: Colores.azulClaro,
    borderRadius: 12,
    padding: 12,
    gap: 2,
  },
  tituloWheels: { fontSize: 13, fontWeight: '700', color: Colores.azulOscuro },
  placa: { fontSize: 24, fontWeight: '800', color: Colores.azulOscuro, letterSpacing: 2 },
  textoWheels: { fontSize: 14, color: Colores.texto, textAlign: 'center' },
});
