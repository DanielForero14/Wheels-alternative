// app/verificar.tsx
// Paso 2 del ingreso: escribir el código que llegó al correo.
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Aviso, Boton, Campo, Encabezado, Pantalla, TextoSuave } from '@/components/wheels/ui';
import { verificarCodigo } from '@/servicios/api';
import { useSesion } from '@/servicios/sesion';

export default function Verificar() {
  const { correo } = useLocalSearchParams<{ correo: string }>();
  const { iniciarSesion } = useSesion();
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const verificar = async () => {
    setError('');
    setCargando(true);
    try {
      const usuario = await verificarCodigo(correo, codigo);
      iniciarSesion(usuario);
      router.replace('/');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <Pantalla>
      <Encabezado titulo="Verifica tu correo" subtitulo={`Enviamos un código a ${correo}`} />
      <Campo
        etiqueta="Código de 6 dígitos"
        value={codigo}
        onChangeText={setCodigo}
        placeholder="000000"
        keyboardType="number-pad"
        maxLength={6}
      />
      {error ? <Aviso tipo="error" texto={error} /> : null}
      <Boton texto="Verificar" onPress={verificar} cargando={cargando} deshabilitado={codigo.length !== 6} />
      <Boton texto="Cambiar correo" tipo="secundario" onPress={() => router.back()} />
      <TextoSuave>
        El código vence en 10 minutos. En esta versión de prueba el correo es simulado: el código aparece en la
        consola del servidor.
      </TextoSuave>
    </Pantalla>
  );
}
