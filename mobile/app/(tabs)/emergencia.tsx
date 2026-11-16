// app/(tabs)/emergencia.tsx
// Contacto de emergencia y botón de pánico (Reto 2).
// El botón se mantiene presionado 3 segundos para evitar alertas por error.
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { Aviso, Boton, Campo, Encabezado, Pantalla, Seccion, TextoSuave } from '@/components/wheels/ui';
import { Colores } from '@/constants/colores';
import {
  activarAlerta,
  Contacto,
  guardarContacto,
  misReservas,
  obtenerContacto,
  viajesDelConductor,
} from '@/servicios/api';
import { useSesion } from '@/servicios/sesion';
import { obtenerUbicacion } from '@/servicios/ubicacion';

const SEGUNDOS_PARA_ACTIVAR = 3;
const NOMBRE_CANAL: Record<string, string> = { EmergenciaNotificador: 'SMS', ConsolaNotificador: 'correo' };

export default function Emergencia() {
  const { usuario } = useSesion();
  const [contacto, setContacto] = useState<Contacto | null>(null);
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [editando, setEditando] = useState(false);
  const [cuentaRegresiva, setCuentaRegresiva] = useState<number | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'exito' | 'error' | 'info'; texto: string } | null>(null);
  const temporizador = useRef<ReturnType<typeof setInterval> | null>(null);

  useFocusEffect(
    useCallback(() => {
      obtenerContacto(usuario!.correo).then(guardado => {
        setContacto(guardado);
        setEditando(!guardado);
        if (guardado) {
          setNombre(guardado.nombre);
          setTelefono(guardado.telefono);
        }
      });
    }, [usuario])
  );

  const guardar = async () => {
    setAviso(null);
    try {
      const nuevo = await guardarContacto(usuario!.correo, nombre, telefono);
      setContacto(nuevo);
      setEditando(false);
      setAviso({ tipo: 'exito', texto: 'Contacto de emergencia guardado.' });
    } catch (e) {
      setAviso({ tipo: 'error', texto: (e as Error).message });
    }
  };

  // Busca el viaje del usuario para enviarlo en la alerta (si tiene alguno).
  const viajeActual = async (): Promise<number | undefined> => {
    if (usuario!.rol === 'conductor') {
      const viajes = await viajesDelConductor(usuario!.correo);
      return viajes.find(v => v.estado !== 'cancelado')?.id;
    }
    const reservas = await misReservas(usuario!.correo);
    return reservas[0]?.viaje.id;
  };

  const enviarAlerta = async () => {
    Vibration.vibrate(400);
    setAviso({ tipo: 'info', texto: 'Enviando alerta...' });
    try {
      // La ubicación es opcional: si no hay permiso, la alerta sale igual, sin ubicación.
      const [viajeId, ubicacion] = await Promise.all([viajeActual(), obtenerUbicacion()]);
      const resultado = await activarAlerta(usuario!.correo, viajeId, ubicacion);
      if (resultado.enviada) {
        const canal = NOMBRE_CANAL[resultado.canal ?? ''] ?? resultado.canal;
        const conUbicacion = ubicacion ? ' con tu ubicación' : '';
        setAviso({ tipo: 'exito', texto: `Alerta enviada a ${resultado.contacto} por ${canal}${conUbicacion}.` });
      } else {
        setAviso({ tipo: 'error', texto: 'No se pudo enviar la alerta. Llama a tu contacto.' });
      }
    } catch (e) {
      setAviso({ tipo: 'error', texto: (e as Error).message });
    }
  };

  // Mantener presionado: cuenta 3, 2, 1 y envía. Si se suelta antes, se cancela.
  const empezarPresion = () => {
    setAviso(null);
    let restante = SEGUNDOS_PARA_ACTIVAR;
    setCuentaRegresiva(restante);
    temporizador.current = setInterval(() => {
      restante -= 1;
      if (restante === 0) {
        detenerPresion();
        enviarAlerta();
      } else {
        setCuentaRegresiva(restante);
      }
    }, 1000);
  };

  const detenerPresion = () => {
    if (temporizador.current) {
      clearInterval(temporizador.current);
      temporizador.current = null;
    }
    setCuentaRegresiva(null);
  };

  return (
    <Pantalla>
      <Encabezado titulo="Emergencia" subtitulo="Tu contacto recibe los datos de tu viaje" />

      <View style={estilos.zonaBoton}>
        <Pressable
          onPressIn={empezarPresion}
          onPressOut={detenerPresion}
          disabled={!contacto}
          style={({ pressed }) => [estilos.botonPanico, pressed && estilos.presionado, !contacto && { opacity: 0.4 }]}>
          <Text style={estilos.textoPanico}>{cuentaRegresiva ?? 'SOS'}</Text>
        </Pressable>
        <TextoSuave>
          {contacto
            ? cuentaRegresiva
              ? 'Sigue presionando...'
              : `Mantén presionado ${SEGUNDOS_PARA_ACTIVAR} segundos para alertar a ${contacto.nombre}`
            : 'Registra un contacto para activar el botón'}
        </TextoSuave>
      </View>

      {aviso ? <Aviso tipo={aviso.tipo} texto={aviso.texto} /> : null}

      {contacto ? (
        <Boton
          texto={`Llamar a ${contacto.nombre}`}
          tipo="secundario"
          onPress={() => Linking.openURL(`tel:${contacto.telefono}`)}
        />
      ) : null}

      <Seccion titulo="Contacto de emergencia" />
      {editando ? (
        <>
          <Campo etiqueta="Nombre" value={nombre} onChangeText={setNombre} placeholder="Ej: Mamá" />
          <Campo
            etiqueta="Teléfono"
            value={telefono}
            onChangeText={setTelefono}
            placeholder="3001234567"
            keyboardType="phone-pad"
          />
          <Boton texto="Guardar contacto" onPress={guardar} />
        </>
      ) : contacto ? (
        <View style={estilos.contacto}>
          <View style={{ flex: 1 }}>
            <Text style={estilos.nombreContacto}>{contacto.nombre}</Text>
            <TextoSuave>{contacto.telefono}</TextoSuave>
          </View>
          <Pressable onPress={() => setEditando(true)} hitSlop={10}>
            <Text style={estilos.cambiar}>Cambiar</Text>
          </Pressable>
        </View>
      ) : null}
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  zonaBoton: { alignItems: 'center', gap: 14, marginVertical: 10 },
  botonPanico: {
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: Colores.panico,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 8,
    borderColor: Colores.errorFondo,
  },
  presionado: { transform: [{ scale: 0.96 }] },
  textoPanico: { color: Colores.blanco, fontSize: 40, fontWeight: '800', letterSpacing: 2 },
  contacto: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colores.blanco,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colores.borde,
  },
  nombreContacto: { fontSize: 17, fontWeight: '700', color: Colores.texto },
  cambiar: { color: Colores.azul, fontWeight: '600', fontSize: 15 },
});
