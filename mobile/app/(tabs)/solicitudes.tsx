// app/(tabs)/solicitudes.tsx
// Conductor: ve quién pide cupo y dónde lo recogen, y decide si lo acepta o no (Reto 1).
// Solo al aceptar se genera el código QR del pasajero.
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import TarjetaViaje from '@/components/wheels/TarjetaViaje';
import { Aviso, Boton, Encabezado, Pantalla, Seccion, TextoSuave } from '@/components/wheels/ui';
import { Colores } from '@/constants/colores';
import { responderSolicitud, Solicitud, solicitudesDelConductor } from '@/servicios/api';
import { useSesion } from '@/servicios/sesion';

const TEXTO_ESTADO = { aceptada: 'Aceptada', rechazada: 'Rechazada', pendiente: 'Pendiente' };

export default function Solicitudes() {
  const { usuario } = useSesion();
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [aviso, setAviso] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);
  const [respondiendo, setRespondiendo] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    try {
      setSolicitudes(await solicitudesDelConductor(usuario!.correo));
    } catch (e) {
      setAviso({ tipo: 'error', texto: (e as Error).message });
    }
  }, [usuario]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  const responder = async (solicitud: Solicitud, aceptar: boolean) => {
    setAviso(null);
    setRespondiendo(solicitud.reserva.id);
    try {
      await responderSolicitud(solicitud.reserva.id, usuario!.correo, aceptar);
      setAviso({
        tipo: 'exito',
        texto: aceptar
          ? `Aceptaste a ${solicitud.pasajero}. Ya tiene su código QR para subir.`
          : `Rechazaste la solicitud de ${solicitud.pasajero}.`,
      });
      cargar();
    } catch (e) {
      setAviso({ tipo: 'error', texto: (e as Error).message });
    } finally {
      setRespondiendo(null);
    }
  };

  const pendientes = solicitudes.filter(s => s.reserva.estado === 'pendiente');
  const respondidas = solicitudes.filter(s => s.reserva.estado !== 'pendiente');

  return (
    <Pantalla>
      <Encabezado titulo="Solicitudes" subtitulo="Decide si el punto de recogida te sirve" />
      {aviso ? <Aviso tipo={aviso.tipo} texto={aviso.texto} /> : null}

      <Seccion titulo={`Pendientes (${pendientes.length})`} />
      {pendientes.length === 0 ? <TextoSuave>No tienes solicitudes nuevas.</TextoSuave> : null}
      {pendientes.map(solicitud => (
        <TarjetaViaje key={solicitud.reserva.id} viaje={solicitud.viaje}>
          <Text style={estilos.pasajero}>{solicitud.pasajero}</Text>
          <Text style={estilos.recogida}>Recogerlo en: {solicitud.reserva.puntoRecogida}</Text>
          <Boton
            texto="Aceptar"
            onPress={() => responder(solicitud, true)}
            cargando={respondiendo === solicitud.reserva.id}
          />
          <Boton texto="Rechazar" tipo="secundario" onPress={() => responder(solicitud, false)} />
        </TarjetaViaje>
      ))}

      {respondidas.length > 0 ? <Seccion titulo="Respondidas" /> : null}
      {respondidas.map(solicitud => (
        <TarjetaViaje key={solicitud.reserva.id} viaje={solicitud.viaje}>
          <Text style={estilos.pasajero}>
            {solicitud.pasajero} · {TEXTO_ESTADO[solicitud.reserva.estado]}
          </Text>
          <Text style={estilos.recogida}>Recogerlo en: {solicitud.reserva.puntoRecogida}</Text>
        </TarjetaViaje>
      ))}
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  pasajero: { fontSize: 16, fontWeight: '700', color: Colores.azulOscuro },
  recogida: { fontSize: 15, color: Colores.texto },
});
