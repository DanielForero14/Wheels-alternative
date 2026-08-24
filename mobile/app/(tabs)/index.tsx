import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, Button, FlatList } from 'react-native';

type Viaje = {
  id: number;
  puntoInicio: string;
  puntoFinal: string;
  hora: string;
  cuposDisponibles: number;
  estado: string;
};

// IMPORTANTE: cambia esta IP por la que te salió en "npx expo start"
// (la que aparece en "Metro waiting on exp://TU_IP:8081")
const API_URL = 'http://172.20.10.3:3000';

export default function HomeScreen() {
  const [viajes, setViajes] = useState<Viaje[]>([]);

  const cargarViajes = async () => {
    try {
      const res = await fetch(`${API_URL}/viajes`);
      const data = await res.json();
      setViajes(data);
    } catch (e) {
      console.log('Error al cargar viajes:', e);
    }
  };

  useEffect(() => {
    cargarViajes();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>WHEELS</Text>
      <Text style={styles.subtitulo}>Transporte Universitario</Text>
      <Button title="Actualizar viajes" onPress={cargarViajes} />
      <FlatList
        data={viajes}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.ruta}>{item.puntoInicio} → {item.puntoFinal}</Text>
            <Text>Hora: {item.hora}</Text>
            <Text>Cupos: {item.cuposDisponibles} | Estado: {item.estado}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={{ marginTop: 20 }}>No hay viajes disponibles.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60 },
  titulo: { fontSize: 32, fontWeight: 'bold' },
  subtitulo: { fontSize: 16, marginBottom: 20, color: 'gray' },
  card: { padding: 15, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, marginTop: 10 },
  ruta: { fontWeight: 'bold', fontSize: 16 },
});