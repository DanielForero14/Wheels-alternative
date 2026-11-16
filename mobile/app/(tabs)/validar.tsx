// app/(tabs)/validar.tsx
// Conductor: escanea el QR del pasajero (o escribe el código) para confirmar que reservó (Reto 1).
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Aviso, Boton, Campo, Encabezado, Opciones, Pantalla, Seccion, TextoSuave } from '@/components/wheels/ui';
import { validarAbordaje, Viaje, viajesDelConductor } from '@/servicios/api';
import { fechaCorta } from '@/servicios/fechas';
import { useSesion } from '@/servicios/sesion';

export default function Validar() {
  const { usuario } = useSesion();
  const [permiso, pedirPermiso] = useCameraPermissions();
  const [viajes, setViajes] = useState<Viaje[]>([]);
  const [viajeId, setViajeId] = useState<string>('');
  const [escaneando, setEscaneando] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [resultado, setResultado] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);
  // La cámara puede leer el mismo QR varias veces seguidas: solo se usa la primera lectura.
  const leyendo = useRef(false);

  useFocusEffect(
    useCallback(() => {
      viajesDelConductor(usuario!.correo).then(lista => {
        const activos = lista.filter(v => v.estado !== 'cancelado');
        setViajes(activos);
        if (activos.length > 0) {
          setViajeId(actual => actual || String(activos[0].id));
        }
      });
      // Al salir de la pestaña se apaga la cámara.
      return () => setEscaneando(false);
    }, [usuario])
  );

  const validar = async (codigoLeido: string) => {
    if (leyendo.current) return;
    leyendo.current = true;
    setEscaneando(false);
    try {
      await validarAbordaje(Number(viajeId), codigoLeido.trim());
      setResultado({ tipo: 'exito', texto: 'Abordaje confirmado. El pasajero puede subir.' });
    } catch (e) {
      setResultado({ tipo: 'error', texto: (e as Error).message });
    }
    setCodigo('');
    leyendo.current = false;
  };

  const abrirCamara = async () => {
    setResultado(null);
    if (!permiso?.granted) {
      const respuesta = await pedirPermiso();
      if (!respuesta.granted) {
        setResultado({ tipo: 'error', texto: 'Sin permiso de cámara. Puedes escribir el código.' });
        return;
      }
    }
    setEscaneando(true);
  };

  if (viajes.length === 0) {
    return (
      <Pantalla>
        <Encabezado titulo="Validar QR" />
        <TextoSuave>Primero programa un viaje en la pestaña Mis viajes.</TextoSuave>
      </Pantalla>
    );
  }

  return (
    <Pantalla>
      <Encabezado titulo="Validar QR" subtitulo="Confirma que el pasajero reservó este viaje" />

      <Seccion titulo="Viaje" />
      <Opciones
        opciones={viajes.slice(0, 3).map(v => ({ // los 3 próximos viajes
          valor: String(v.id),
          texto: `${fechaCorta(v.fecha)} ${v.hora}`,
        }))}
        valor={viajeId}
        onCambio={setViajeId}
      />

      {escaneando ? (
        <View style={estilos.camara}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => validar(data)}
          />
        </View>
      ) : null}

      {resultado ? <Aviso tipo={resultado.tipo} texto={resultado.texto} /> : null}

      {escaneando ? (
        <Boton texto="Cerrar cámara" tipo="secundario" onPress={() => setEscaneando(false)} />
      ) : (
        <Boton texto="Escanear código QR" onPress={abrirCamara} />
      )}

      <Seccion titulo="O escribe el código" />
      <Campo etiqueta="Código de la reserva" value={codigo} onChangeText={setCodigo} autoCapitalize="none" />
      <Boton texto="Validar código" tipo="secundario" onPress={() => validar(codigo)} deshabilitado={!codigo} />
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  camara: { height: 300, borderRadius: 14, overflow: 'hidden' },
});
