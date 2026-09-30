// components/wheels/MisViajesConductor.tsx
// Conductor: programar un viaje con anticipación y ver o cancelar los suyos (Reto 3).
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colores } from '@/constants/colores';
import { cancelarViaje, programarViaje, Viaje, viajesDelConductor } from '@/servicios/api';
import { fechaEnDias } from '@/servicios/fechas';
import { useSesion } from '@/servicios/sesion';
import TarjetaViaje from './TarjetaViaje';
import { Aviso, Boton, Campo, Encabezado, Pantalla, Seccion, TextoSuave } from './ui';

export default function MisViajesConductor() {
  const { usuario } = useSesion();
  const [origen, setOrigen] = useState('');
  const [destino, setDestino] = useState('Universidad de La Sabana');
  const [fecha, setFecha] = useState(fechaEnDias(1));
  const [hora, setHora] = useState('07:00');
  const [cupos, setCupos] = useState(3);
  const [descripcionRuta, setDescripcionRuta] = useState('');
  const [viajes, setViajes] = useState<Viaje[]>([]);
  const [aviso, setAviso] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setViajes(await viajesDelConductor(usuario!.correo));
    } catch (e) {
      setAviso({ tipo: 'error', texto: (e as Error).message });
    }
  }, [usuario]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  const programar = async () => {
    setAviso(null);
    setGuardando(true);
    try {
      await programarViaje({
        conductorId: usuario!.correo,
        puntoInicio: origen,
        puntoFinal: destino,
        fecha,
        hora,
        cuposDisponibles: cupos,
        descripcionRuta,
      });
      setAviso({ tipo: 'exito', texto: 'Viaje programado. Ya aparece en la búsqueda de los pasajeros.' });
      setOrigen('');
      setDescripcionRuta('');
      cargar();
    } catch (e) {
      setAviso({ tipo: 'error', texto: (e as Error).message });
    } finally {
      setGuardando(false);
    }
  };

  const cancelar = async (viaje: Viaje) => {
    try {
      await cancelarViaje(viaje.id);
      cargar();
    } catch (e) {
      setAviso({ tipo: 'error', texto: (e as Error).message });
    }
  };

  return (
    <Pantalla>
      <Encabezado titulo="Mis viajes" subtitulo={`Hola, ${usuario?.nombre}`} />

      <Seccion titulo="Programar un viaje" />
      <Campo etiqueta="Desde" value={origen} onChangeText={setOrigen} placeholder="Ej: Chía" />
      <Campo etiqueta="Hacia" value={destino} onChangeText={setDestino} />
      <Campo
        etiqueta="Por dónde pasa (opcional)"
        value={descripcionRuta}
        onChangeText={setDescripcionRuta}
        placeholder="Ej: Autopista Norte hasta la 134, luego la Séptima"
        multiline
        maxLength={200}
      />
      <View style={estilos.fila}>
        <View style={{ flex: 1 }}>
          <Campo etiqueta="Fecha (AAAA-MM-DD)" value={fecha} onChangeText={setFecha} />
        </View>
        <View style={{ flex: 1 }}>
          <Campo etiqueta="Hora (HH:MM)" value={hora} onChangeText={setHora} />
        </View>
      </View>

      <Text style={estilos.etiqueta}>Cupos</Text>
      <View style={estilos.cupos}>
        <View style={estilos.botonCupo}>
          <Boton texto="−" tipo="secundario" onPress={() => setCupos(Math.max(1, cupos - 1))} />
        </View>
        <Text style={estilos.numeroCupos}>{cupos}</Text>
        <View style={estilos.botonCupo}>
          <Boton texto="+" tipo="secundario" onPress={() => setCupos(Math.min(6, cupos + 1))} />
        </View>
      </View>

      {aviso ? <Aviso tipo={aviso.tipo} texto={aviso.texto} /> : null}
      <Boton texto="Programar viaje" onPress={programar} cargando={guardando} />

      <Seccion titulo="Viajes programados" />
      {viajes.length === 0 ? <TextoSuave>Todavía no has programado viajes.</TextoSuave> : null}
      {viajes.map(viaje => (
        <TarjetaViaje key={viaje.id} viaje={viaje}>
          {viaje.estado !== 'cancelado' ? (
            <Boton texto="Cancelar viaje" tipo="secundario" onPress={() => cancelar(viaje)} />
          ) : null}
        </TarjetaViaje>
      ))}
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', gap: 10 },
  etiqueta: { fontSize: 14, color: Colores.texto, fontWeight: '600' },
  cupos: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  botonCupo: { width: 56 },
  numeroCupos: { fontSize: 22, fontWeight: '700', color: Colores.azulOscuro, minWidth: 24, textAlign: 'center' },
});
