// components/wheels/SelectorFechaHora.tsx
// Calendario mensual y selector de hora, hechos con componentes básicos
// para que funcionen igual en el celular y en el navegador.
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colores } from '@/constants/colores';
import { fechaEnDias, fechaLarga } from '@/servicios/fechas';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];
const HORAS = Array.from({ length: 18 }, (_, i) => i + 5); // de 5 a 22
const MINUTOS = Array.from({ length: 12 }, (_, i) => i * 5); // 00, 05, 10 ... 55
const ALTO_FILA = 40;

const dosDigitos = (n: number) => String(n).padStart(2, '0');

// Campo que muestra el valor y, al tocarlo, abre o cierra su panel.
function CampoDesplegable({
  etiqueta,
  texto,
  icono,
  abierto,
  onPress,
}: {
  etiqueta: string;
  texto: string;
  icono: keyof typeof Ionicons.glyphMap;
  abierto: boolean;
  onPress: () => void;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={estilos.etiqueta}>{etiqueta}</Text>
      <Pressable onPress={onPress} style={[estilos.campo, abierto && { borderColor: Colores.azul }]}>
        <Text style={estilos.textoCampo}>{texto}</Text>
        <Ionicons name={icono} size={20} color={Colores.azul} />
      </Pressable>
    </View>
  );
}

// ---------- Fecha ----------
export function SelectorFecha({ valor, onCambio }: { valor: string; onCambio: (fecha: string) => void }) {
  const [abierto, setAbierto] = useState(false);
  const hoy = fechaEnDias(0);
  const [anio, mes] = valor.split('-').map(Number);
  const [mesVisible, setMesVisible] = useState({ anio, mes: mes - 1 }); // mes de 0 a 11

  const primerDia = new Date(mesVisible.anio, mesVisible.mes, 1).getDay(); // 0 = domingo
  const diasDelMes = new Date(mesVisible.anio, mesVisible.mes + 1, 0).getDate();
  const casillas: (number | null)[] = [
    ...Array(primerDia).fill(null),
    ...Array.from({ length: diasDelMes }, (_, i) => i + 1),
  ];

  const cambiarMes = (paso: number) => {
    const fecha = new Date(mesVisible.anio, mesVisible.mes + paso, 1);
    setMesVisible({ anio: fecha.getFullYear(), mes: fecha.getMonth() });
  };

  const elegir = (dia: number) => {
    onCambio(`${mesVisible.anio}-${dosDigitos(mesVisible.mes + 1)}-${dosDigitos(dia)}`);
    setAbierto(false);
  };

  return (
    <View style={{ gap: 8 }}>
      <CampoDesplegable
        etiqueta="Fecha"
        texto={fechaLarga(valor)}
        icono="calendar-outline"
        abierto={abierto}
        onPress={() => setAbierto(!abierto)}
      />
      {abierto ? (
        <View style={estilos.panel}>
          <View style={estilos.cabeceraMes}>
            <Text style={estilos.nombreMes}>
              {MESES[mesVisible.mes]} {mesVisible.anio}
            </Text>
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <Pressable onPress={() => cambiarMes(-1)} hitSlop={10}>
                <Ionicons name="chevron-back" size={20} color={Colores.textoSuave} />
              </Pressable>
              <Pressable onPress={() => cambiarMes(1)} hitSlop={10}>
                <Ionicons name="chevron-forward" size={20} color={Colores.textoSuave} />
              </Pressable>
            </View>
          </View>

          <View style={estilos.cuadricula}>
            {DIAS.map(dia => (
              <Text key={dia} style={estilos.diaSemana}>
                {dia}
              </Text>
            ))}
            {casillas.map((dia, i) => {
              if (dia === null) {
                return <View key={`vacia-${i}`} style={estilos.casilla} />;
              }
              const fecha = `${mesVisible.anio}-${dosDigitos(mesVisible.mes + 1)}-${dosDigitos(dia)}`;
              const pasada = fecha < hoy; // no se puede programar un viaje en el pasado
              const elegida = fecha === valor;
              return (
                <Pressable key={fecha} style={estilos.casilla} disabled={pasada} onPress={() => elegir(dia)}>
                  <View style={[estilos.circulo, elegida && { backgroundColor: Colores.azul }]}>
                    <Text
                      style={[
                        estilos.numeroDia,
                        pasada && { color: Colores.borde },
                        elegida && { color: Colores.blanco, fontWeight: '700' },
                      ]}>
                      {dia}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

// ---------- Hora ----------
// Una columna con scroll, como la rueda de hora del celular.
// La fila elegida se marca con una franja azul clara.
function Columna({
  opciones,
  elegida,
  sufijo,
  onElegir,
}: {
  opciones: number[];
  elegida: number;
  sufijo: string;
  onElegir: (n: number) => void;
}) {
  const lista = useRef<ScrollView>(null);

  // Al abrir, la lista se mueve para que la opción elegida quede a la vista.
  const centrarElegida = () => {
    const posicion = Math.max(opciones.indexOf(elegida) - 2, 0) * ALTO_FILA;
    lista.current?.scrollTo({ y: posicion, animated: false });
  };

  return (
    <ScrollView
      ref={lista}
      style={estilos.columna}
      onLayout={centrarElegida}
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}>
      {opciones.map(n => {
        const esElegida = n === elegida;
        return (
          <Pressable key={n} onPress={() => onElegir(n)} style={[estilos.fila, esElegida && estilos.filaElegida]}>
            <Text style={[estilos.textoFila, esElegida && estilos.textoFilaElegida]}>
              {dosDigitos(n)} {sufijo}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function SelectorHora({ valor, onCambio }: { valor: string; onCambio: (hora: string) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [hora, minutos] = valor.split(':').map(Number);

  return (
    <View style={{ gap: 8 }}>
      <CampoDesplegable
        etiqueta="Hora"
        texto={valor}
        icono="time-outline"
        abierto={abierto}
        onPress={() => setAbierto(!abierto)}
      />
      {abierto ? (
        <View style={estilos.panel}>
          <View style={estilos.columnas}>
            <Columna
              opciones={HORAS}
              elegida={hora}
              sufijo="h"
              onElegir={h => onCambio(`${dosDigitos(h)}:${dosDigitos(minutos)}`)}
            />
            <Columna
              opciones={MINUTOS}
              elegida={minutos}
              sufijo="min"
              onElegir={m => onCambio(`${dosDigitos(hora)}:${dosDigitos(m)}`)}
            />
          </View>
          <Pressable onPress={() => setAbierto(false)} style={estilos.botonListo}>
            <Text style={estilos.textoListo}>Listo</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  etiqueta: { fontSize: 14, color: Colores.texto, fontWeight: '600' },
  campo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colores.blanco,
    borderWidth: 1,
    borderColor: Colores.borde,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  textoCampo: { fontSize: 16, color: Colores.texto },
  panel: {
    backgroundColor: Colores.blanco,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colores.borde,
    padding: 12,
    gap: 8,
  },
  cabeceraMes: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 },
  nombreMes: { fontSize: 16, fontWeight: '700', color: Colores.texto },
  cuadricula: { flexDirection: 'row', flexWrap: 'wrap' },
  casilla: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  diaSemana: { width: `${100 / 7}%`, paddingVertical: 6, fontSize: 13, fontWeight: '700', color: Colores.texto, textAlign: 'center' },
  circulo: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  numeroDia: { fontSize: 15, color: Colores.texto },
  columnas: { flexDirection: 'row', gap: 8 },
  columna: { flex: 1, height: ALTO_FILA * 5 },
  fila: { height: ALTO_FILA, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  filaElegida: { backgroundColor: Colores.azulClaro },
  textoFila: { fontSize: 17, color: Colores.textoSuave },
  textoFilaElegida: { color: Colores.azul, fontWeight: '700' },
  botonListo: { alignSelf: 'flex-end', paddingVertical: 6, paddingHorizontal: 12 },
  textoListo: { fontSize: 15, fontWeight: '700', color: Colores.azul },
});
