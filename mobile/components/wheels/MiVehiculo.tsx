// components/wheels/MiVehiculo.tsx
// Conductor: placa y descripción de su carro (marca, modelo, color...).
// Se llena una vez y se puede editar. El pasajero solo lo ve cuando lo aceptan.
// Ya guardado, queda cerrado en un botón "Mi vehículo" que se abre al tocarlo.
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colores } from '@/constants/colores';
import { guardarVehiculo, Vehiculo } from '@/servicios/api';
import { Aviso, Boton, Campo, Seccion, Tarjeta } from './ui';

export default function MiVehiculo({
  correo,
  vehiculo,
  onGuardado,
}: {
  correo: string;
  vehiculo: Vehiculo | null;
  onGuardado: (vehiculo: Vehiculo) => void;
}) {
  // Si todavía no tiene vehículo, el formulario sale abierto de una vez.
  const [editando, setEditando] = useState(false);
  const [abierto, setAbierto] = useState(false); // muestra la placa y la descripción
  const [placa, setPlaca] = useState(vehiculo?.placa ?? '');
  const [descripcion, setDescripcion] = useState(vehiculo?.descripcion ?? '');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    setError('');
    setGuardando(true);
    try {
      onGuardado(await guardarVehiculo(correo, placa, descripcion));
      setEditando(false);
      setAbierto(false); // al guardar se cierra
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  const abrirEdicion = () => {
    setPlaca(vehiculo?.placa ?? '');
    setDescripcion(vehiculo?.descripcion ?? '');
    setEditando(true);
  };

  if (vehiculo && !editando) {
    return (
      <View style={{ gap: 8 }}>
        <Pressable onPress={() => setAbierto(!abierto)} style={[estilos.boton, abierto && { borderColor: Colores.azul }]}>
          <Ionicons name="car-outline" size={22} color={Colores.azul} />
          <Text style={estilos.textoBoton}>Mi vehículo</Text>
          <Ionicons name={abierto ? 'chevron-up' : 'chevron-down'} size={20} color={Colores.textoSuave} />
        </Pressable>
        {abierto ? (
          <Tarjeta>
            <Text style={estilos.placa}>{vehiculo.placa}</Text>
            <Text style={estilos.descripcion}>{vehiculo.descripcion}</Text>
            <Boton texto="Editar vehículo" tipo="secundario" onPress={abrirEdicion} />
          </Tarjeta>
        ) : null}
      </View>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      <Seccion titulo="Mi vehículo" />
      {!vehiculo ? (
        <Aviso tipo="info" texto="Registra tu vehículo para poder programar viajes. El pasajero lo verá cuando lo aceptes." />
      ) : null}
      {error ? <Aviso tipo="error" texto={error} /> : null}
      <Campo etiqueta="Placa" value={placa} onChangeText={setPlaca} autoCapitalize="characters" maxLength={7} />
      <Campo
        etiqueta="Descripción (marca, modelo y color)"
        value={descripcion}
        onChangeText={setDescripcion}
        maxLength={100}
      />
      <Boton texto="Guardar vehículo" onPress={guardar} cargando={guardando} />
      {vehiculo ? <Boton texto="Cancelar" tipo="secundario" onPress={() => setEditando(false)} /> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  boton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colores.blanco,
    borderWidth: 1,
    borderColor: Colores.borde,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  textoBoton: { flex: 1, fontSize: 16, fontWeight: '600', color: Colores.texto },
  placa: { fontSize: 22, fontWeight: '800', color: Colores.azulOscuro, letterSpacing: 2 },
  descripcion: { fontSize: 15, color: Colores.texto },
});
