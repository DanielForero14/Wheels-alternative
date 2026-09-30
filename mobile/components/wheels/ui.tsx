// components/wheels/ui.tsx
// Piezas visuales reutilizables de WHEELS: sencillas, en blanco y azul.
import { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colores } from '@/constants/colores';
import { useSesion } from '@/servicios/sesion';

// Contenedor de cada pantalla, con desplazamiento.
export function Pantalla({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={estilos.pantalla} edges={['top']}>
      <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

// Título de la pantalla con el nombre del usuario y el botón para salir.
export function Encabezado({ titulo, subtitulo }: { titulo: string; subtitulo?: string }) {
  const { usuario, cerrarSesion } = useSesion();
  return (
    <View style={estilos.encabezado}>
      <View style={{ flex: 1 }}>
        <Text style={estilos.titulo}>{titulo}</Text>
        {subtitulo ? <Text style={estilos.subtitulo}>{subtitulo}</Text> : null}
      </View>
      {usuario ? (
        <Pressable onPress={cerrarSesion} hitSlop={10}>
          <Text style={estilos.salir}>Salir</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

type TipoBoton = 'primario' | 'secundario' | 'peligro';

export function Boton({
  texto,
  onPress,
  tipo = 'primario',
  cargando = false,
  deshabilitado = false,
}: {
  texto: string;
  onPress: () => void;
  tipo?: TipoBoton;
  cargando?: boolean;
  deshabilitado?: boolean;
}) {
  const inactivo = cargando || deshabilitado;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactivo}
      style={({ pressed }) => [
        estilos.boton,
        tipo === 'primario' && estilos.botonPrimario,
        tipo === 'secundario' && estilos.botonSecundario,
        tipo === 'peligro' && estilos.botonPeligro,
        pressed && { opacity: 0.85 },
        inactivo && { opacity: 0.5 },
      ]}>
      {cargando ? (
        <ActivityIndicator color={tipo === 'secundario' ? Colores.azul : Colores.blanco} />
      ) : (
        <Text style={[estilos.textoBoton, tipo === 'secundario' && { color: Colores.azul }]}>{texto}</Text>
      )}
    </Pressable>
  );
}

export function Campo({ etiqueta, ...props }: { etiqueta: string } & TextInputProps) {
  return (
    <View style={estilos.campo}>
      <Text style={estilos.etiqueta}>{etiqueta}</Text>
      <TextInput placeholderTextColor={Colores.textoSuave} style={estilos.input} {...props} />
    </View>
  );
}

export function Tarjeta({ children }: { children: ReactNode }) {
  return <View style={estilos.tarjeta}>{children}</View>;
}

// Mensaje de resultado: verde si salió bien, rojo si hubo error, azul si es información.
export function Aviso({ tipo, texto }: { tipo: 'exito' | 'error' | 'info'; texto: string }) {
  const colores = {
    exito: { fondo: Colores.exitoFondo, texto: Colores.exito },
    error: { fondo: Colores.errorFondo, texto: Colores.error },
    info: { fondo: Colores.azulClaro, texto: Colores.azulOscuro },
  }[tipo];
  return (
    <View style={[estilos.aviso, { backgroundColor: colores.fondo }]}>
      <Text style={{ color: colores.texto, fontSize: 15 }}>{texto}</Text>
    </View>
  );
}

// Grupo de opciones donde solo una queda seleccionada (ej. pasajero / conductor).
export function Opciones<T extends string>({
  opciones,
  valor,
  onCambio,
}: {
  opciones: { valor: T; texto: string }[];
  valor: T;
  onCambio: (valor: T) => void;
}) {
  return (
    <View style={estilos.opciones}>
      {opciones.map(opcion => {
        const activa = opcion.valor === valor;
        return (
          <Pressable
            key={opcion.valor}
            onPress={() => onCambio(opcion.valor)}
            style={[estilos.opcion, activa && estilos.opcionActiva]}>
            <Text style={[estilos.textoOpcion, activa && { color: Colores.blanco }]}>{opcion.texto}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Seccion({ titulo }: { titulo: string }) {
  return <Text style={estilos.seccion}>{titulo}</Text>;
}

export function TextoSuave({ children }: { children: ReactNode }) {
  return <Text style={estilos.textoSuave}>{children}</Text>;
}

export const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: Colores.fondo },
  contenido: { padding: 20, paddingBottom: 40, gap: 14, width: '100%', maxWidth: 560, alignSelf: 'center' },
  encabezado: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  titulo: { fontSize: 26, fontWeight: '700', color: Colores.azulOscuro },
  subtitulo: { fontSize: 14, color: Colores.textoSuave, marginTop: 2 },
  salir: { color: Colores.azul, fontSize: 15, fontWeight: '600' },
  boton: { paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  botonPrimario: { backgroundColor: Colores.azul },
  botonSecundario: { backgroundColor: Colores.blanco, borderWidth: 1.5, borderColor: Colores.azul },
  botonPeligro: { backgroundColor: Colores.panico },
  textoBoton: { color: Colores.blanco, fontSize: 16, fontWeight: '600' },
  campo: { gap: 6 },
  etiqueta: { fontSize: 14, color: Colores.texto, fontWeight: '600' },
  input: {
    backgroundColor: Colores.blanco,
    borderWidth: 1,
    borderColor: Colores.borde,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: Colores.texto,
  },
  tarjeta: {
    backgroundColor: Colores.blanco,
    borderRadius: 14,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: Colores.borde,
  },
  aviso: { padding: 14, borderRadius: 10 },
  opciones: { flexDirection: 'row', gap: 8 },
  opcion: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colores.azul,
    alignItems: 'center',
    backgroundColor: Colores.blanco,
  },
  opcionActiva: { backgroundColor: Colores.azul },
  textoOpcion: { color: Colores.azul, fontWeight: '600', fontSize: 15 },
  seccion: { fontSize: 17, fontWeight: '700', color: Colores.texto, marginTop: 8 },
  textoSuave: { fontSize: 14, color: Colores.textoSuave },
});
