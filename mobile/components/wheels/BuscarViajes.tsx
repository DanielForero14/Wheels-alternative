// components/wheels/BuscarViajes.tsx
// Pasajero: buscar viajes por fecha, origen y destino, y reservar un cupo (Reto 3 y Reto 1).
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { buscarViajes, solicitarCupo, Viaje } from '@/servicios/api';
import { fechaEnDias } from '@/servicios/fechas';
import { useSesion } from '@/servicios/sesion';
import TarjetaViaje from './TarjetaViaje';
import TiempoEstimado from './TiempoEstimado';
import { Aviso, Boton, Campo, Encabezado, Opciones, Pantalla, Seccion, TextoSuave } from './ui';

type Dia = 'todos' | 'hoy' | 'manana';

export default function BuscarViajes() {
  const { usuario } = useSesion();
  const [dia, setDia] = useState<Dia>('todos');
  const [origen, setOrigen] = useState('');
  const [destino, setDestino] = useState('');
  const [viajes, setViajes] = useState<Viaje[]>([]);
  const [aviso, setAviso] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);
  const [solicitando, setSolicitando] = useState<number | null>(null); // viaje con el formulario abierto
  const [puntoRecogida, setPuntoRecogida] = useState('');
  const [enviando, setEnviando] = useState(false);

  const buscar = useCallback(async () => {
    const fecha = dia === 'hoy' ? fechaEnDias(0) : dia === 'manana' ? fechaEnDias(1) : undefined;
    try {
      setViajes(await buscarViajes({ fecha, origen, destino }));
    } catch (e) {
      setAviso({ tipo: 'error', texto: (e as Error).message });
    }
  }, [dia, origen, destino]);

  // Cada vez que se abre la pestaña se actualiza la lista.
  useFocusEffect(
    useCallback(() => {
      buscar();
    }, [buscar])
  );

  const enviarSolicitud = async (viaje: Viaje) => {
    setAviso(null);
    setEnviando(true);
    try {
      await solicitarCupo(viaje.id, usuario!.correo, puntoRecogida);
      setAviso({
        tipo: 'exito',
        texto: `Solicitud enviada para ${viaje.puntoInicio} → ${viaje.puntoFinal}. Cuando el conductor la acepte, tu código QR aparece en Mis reservas.`,
      });
      setSolicitando(null);
      setPuntoRecogida('');
    } catch (e) {
      setAviso({ tipo: 'error', texto: (e as Error).message });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Pantalla>
      <Encabezado titulo="Viajes" subtitulo={`Hola, ${usuario?.nombre}`} />

      <Opciones
        opciones={[
          { valor: 'todos', texto: 'Todos' },
          { valor: 'hoy', texto: 'Hoy' },
          { valor: 'manana', texto: 'Mañana' },
        ]}
        valor={dia}
        onCambio={setDia}
      />
      <Campo etiqueta="Desde" value={origen} onChangeText={setOrigen} placeholder="Ej: Chía" />
      <Campo etiqueta="Hacia" value={destino} onChangeText={setDestino} placeholder="Ej: Universidad" />
      <Boton texto="Buscar" onPress={buscar} />

      {aviso ? <Aviso tipo={aviso.tipo} texto={aviso.texto} /> : null}
      {aviso?.tipo === 'exito' ? (
        <Boton texto="Ver mis reservas" tipo="secundario" onPress={() => router.push('/reservas')} />
      ) : null}

      <Seccion titulo={`${viajes.length} ${viajes.length === 1 ? 'viaje disponible' : 'viajes disponibles'}`} />
      {viajes.length === 0 ? <TextoSuave>No hay viajes con esos filtros.</TextoSuave> : null}
      {viajes.map(viaje => (
        <TarjetaViaje key={viaje.id} viaje={viaje}>
          <TiempoEstimado viaje={viaje} />
          {solicitando === viaje.id ? (
            <>
              <Campo
                etiqueta="¿Dónde te recoge el conductor?"
                value={puntoRecogida}
                onChangeText={setPuntoRecogida}
                placeholder="Ej: Portal Norte, salida oriental"
                maxLength={150}
              />
              <Boton texto="Enviar solicitud" onPress={() => enviarSolicitud(viaje)} cargando={enviando} />
              <Boton texto="Cancelar" tipo="secundario" onPress={() => setSolicitando(null)} />
            </>
          ) : (
            <Boton
              texto="Solicitar cupo"
              onPress={() => {
                setSolicitando(viaje.id);
                setPuntoRecogida('');
              }}
            />
          )}
        </TarjetaViaje>
      ))}
    </Pantalla>
  );
}
