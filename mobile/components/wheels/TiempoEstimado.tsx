// components/wheels/TiempoEstimado.tsx
// Reto 3: botón "¿Cuánto me demoro?" dentro de la tarjeta de un viaje.
// Toma la ubicación actual, pide al backend la distancia y el tiempo, y permite abrir la ruta en el mapa.
import { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { Colores } from '@/constants/colores';
import { tiempoEstimado, TiempoEstimado as Resultado, Viaje } from '@/servicios/api';
import { obtenerUbicacion, Ubicacion } from '@/servicios/ubicacion';
import { Aviso, Boton } from './ui';

const NOMBRE_FUENTE: Record<string, string> = {
  RutasOpenStreetMap: 'ruta por calles (OpenStreetMap, sin tráfico en vivo)',
  RutasEstimadas: 'cálculo aproximado (servicio de mapas no disponible)',
  RutasSimuladasLentas: 'servicio de rutas simulado',
};

export default function TiempoEstimado({ viaje }: { viaje: Viaje }) {
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [ubicacion, setUbicacion] = useState<Ubicacion | null>(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const calcular = async () => {
    setError('');
    setCargando(true);
    const actual = await obtenerUbicacion();
    if (!actual) {
      setError('No pudimos obtener tu ubicación. Revisa que la app tenga permiso.');
      setCargando(false);
      return;
    }
    try {
      setUbicacion(actual);
      setResultado(await tiempoEstimado(viaje.id, actual.lat, actual.lon));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  };

  // Abre Google Maps con la ruta desde la ubicación actual hasta el destino del viaje.
  const abrirMapa = () => {
    if (!ubicacion) return;
    const url =
      'https://www.google.com/maps/dir/?api=1&travelmode=driving' +
      `&origin=${ubicacion.lat},${ubicacion.lon}` +
      `&destination=${encodeURIComponent(viaje.puntoFinal)}`;
    Linking.openURL(url);
  };

  if (!resultado) {
    return (
      <View style={{ gap: 8 }}>
        {error ? <Aviso tipo="error" texto={error} /> : null}
        <Boton texto="¿Cuánto me demoro?" tipo="secundario" onPress={calcular} cargando={cargando} />
      </View>
    );
  }

  return (
    <View style={estilos.caja}>
      <Text style={estilos.tiempo}>
        {resultado.minutos} min · {resultado.distanciaKm} km
      </Text>
      <Text style={estilos.detalle}>Desde tu ubicación hasta {resultado.destino}</Text>
      <Text style={estilos.fuente}>
        {NOMBRE_FUENTE[resultado.fuente] ?? resultado.fuente}
        {resultado.desdeCache ? ' · consulta reciente' : ''}
      </Text>
      <View style={estilos.botones}>
        <View style={{ flex: 1 }}>
          <Boton texto="Ver en el mapa" onPress={abrirMapa} />
        </View>
        <View style={{ flex: 1 }}>
          <Boton texto="Actualizar" tipo="secundario" onPress={calcular} cargando={cargando} />
        </View>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  caja: { backgroundColor: Colores.azulClaro, borderRadius: 12, padding: 14, gap: 4 },
  tiempo: { fontSize: 22, fontWeight: '700', color: Colores.azulOscuro },
  detalle: { fontSize: 14, color: Colores.texto },
  fuente: { fontSize: 12, color: Colores.textoSuave },
  botones: { flexDirection: 'row', gap: 8, marginTop: 8 },
});
