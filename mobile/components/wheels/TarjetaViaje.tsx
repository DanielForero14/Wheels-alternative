// components/wheels/TarjetaViaje.tsx
// Muestra un viaje: ruta, fecha, hora, cupos y, si llega, el nombre del conductor.
import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colores } from '@/constants/colores';
import { Viaje } from '@/servicios/api';
import { fechaCorta } from '@/servicios/fechas';
import { Tarjeta } from './ui';

const TEXTO_ESTADO = { disponible: 'Disponible', lleno: 'Lleno', cancelado: 'Cancelado' };

export default function TarjetaViaje({ viaje, children }: { viaje: Viaje; children?: ReactNode }) {
  return (
    <Tarjeta>
      <View style={estilos.fila}>
        <Text style={estilos.ruta}>
          {viaje.puntoInicio} → {viaje.puntoFinal}
        </Text>
        <Text style={[estilos.estado, viaje.estado !== 'disponible' && { color: Colores.textoSuave }]}>
          {TEXTO_ESTADO[viaje.estado]}
        </Text>
      </View>
      <Text style={estilos.detalle}>
        {fechaCorta(viaje.fecha)} · {viaje.hora} · {viaje.cuposDisponibles}{' '}
        {viaje.cuposDisponibles === 1 ? 'cupo' : 'cupos'}
      </Text>
      {viaje.conductorNombre ? <Text style={estilos.ruta2}>Conductor: {viaje.conductorNombre}</Text> : null}
      {viaje.descripcionRuta ? <Text style={estilos.ruta2}>Pasa por: {viaje.descripcionRuta}</Text> : null}
      {children}
    </Tarjeta>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  ruta: { fontSize: 17, fontWeight: '700', color: Colores.texto, flex: 1 },
  estado: { fontSize: 13, fontWeight: '600', color: Colores.azul },
  detalle: { fontSize: 15, color: Colores.textoSuave },
  ruta2: { fontSize: 14, color: Colores.texto },
});
