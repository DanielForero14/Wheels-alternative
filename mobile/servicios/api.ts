// servicios/api.ts
// Único archivo que sabe hablar con el backend (idea de "adaptador", como en el backend).
// Las pantallas solo llaman estas funciones; no conocen URLs ni fetch.
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Busca la IP del computador automáticamente:
// - en el navegador usa la misma dirección de la página
// - en el celular (Expo Go) usa la IP desde donde se cargó la app
function calcularUrlApi(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `http://${window.location.hostname}:3000`;
  }
  const hostUri = Constants.expoConfig?.hostUri; // ej: "192.168.1.5:8081"
  const ip = hostUri ? hostUri.split(':')[0] : 'localhost';
  return `http://${ip}:3000`;
}

export const API_URL = calcularUrlApi();

// ---------- Tipos de datos que devuelve el backend ----------
export type Rol = 'pasajero' | 'conductor';

export type Usuario = {
  correo: string;
  nombre: string;
  rol: Rol;
  verificado: boolean;
};

export type Viaje = {
  id: number;
  conductorId: string;
  puntoInicio: string;
  puntoFinal: string;
  fecha: string;
  hora: string;
  cuposDisponibles: number;
  estado: 'disponible' | 'lleno' | 'cancelado';
  descripcionRuta?: string; // por dónde pasa (lo escribe el conductor)
};

export type Reserva = {
  id: number;
  viajeId: number;
  pasajeroId: string;
  codigo: string | null;
  expira: number | null;
  usada: boolean;
  estado: 'pendiente' | 'aceptada' | 'rechazada';
  puntoRecogida: string;
};

export type ReservaConQR = { reserva: Reserva; viaje: Viaje; imagenQR: string | null };

export type Solicitud = { reserva: Reserva; viaje: Viaje; pasajero: string };

export type Contacto = { usuarioId: string; nombre: string; telefono: string };

export type ResultadoAlerta = { enviada: boolean; canal: string | null; contacto: string };

export type TiempoEstimado = {
  viajeId: number;
  destino: string;
  distanciaKm: number;
  minutos: number;
  fuente: string;
  desdeCache: boolean;
};

// ---------- Función base ----------
async function pedir<T>(ruta: string, metodo = 'GET', cuerpo?: object): Promise<T> {
  let respuesta: Response;
  try {
    respuesta = await fetch(`${API_URL}${ruta}`, {
      method: metodo,
      headers: { 'Content-Type': 'application/json' },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    throw new Error('No hay conexión con el servidor. Revisa que el backend esté encendido.');
  }
  const datos = await respuesta.json();
  if (!respuesta.ok && respuesta.status !== 503) {
    throw new Error(datos.error || 'Ocurrió un error');
  }
  return datos as T;
}

// ---------- Ingreso ----------
export const solicitarCodigo = (nombre: string, correo: string, rol: Rol) =>
  pedir<{ mensaje: string }>('/auth/solicitar-codigo', 'POST', { nombre, correo, rol });

export const verificarCodigo = (correo: string, codigo: string) =>
  pedir<Usuario>('/auth/verificar', 'POST', { correo, codigo });

// ---------- Viajes (Reto 3) ----------
export const buscarViajes = (filtros: { fecha?: string; origen?: string; destino?: string }) => {
  const parametros = Object.entries(filtros)
    .filter(([, valor]) => valor)
    .map(([clave, valor]) => `${clave}=${encodeURIComponent(String(valor))}`)
    .join('&');
  return pedir<Viaje[]>(`/viajes${parametros ? `?${parametros}` : ''}`);
};

export const programarViaje = (datos: Omit<Viaje, 'id' | 'estado'>) =>
  pedir<Viaje>('/viajes', 'POST', datos);

export const viajesDelConductor = (correo: string) =>
  pedir<Viaje[]>(`/usuarios/${correo}/viajes`);

// Reto 3: cuánto se demora desde la ubicación actual hasta el destino del viaje.
export const tiempoEstimado = (viajeId: number, lat: number, lon: number) =>
  pedir<TiempoEstimado>(`/viajes/${viajeId}/tiempo-estimado?lat=${lat}&lon=${lon}`);

export const cancelarViaje = (viajeId: number) =>
  pedir<Viaje>(`/viajes/${viajeId}/cancelar`, 'POST');

// ---------- Reservas y QR (Reto 1) ----------
// El pasajero solicita un cupo con su punto de recogida; queda pendiente hasta que el conductor responda.
export const solicitarCupo = (viajeId: number, pasajeroId: string, puntoRecogida: string) =>
  pedir<{ reserva: Reserva }>(`/viajes/${viajeId}/reservar`, 'POST', { pasajeroId, puntoRecogida });

export const solicitudesDelConductor = (correo: string) =>
  pedir<Solicitud[]>(`/usuarios/${correo}/solicitudes`);

export const responderSolicitud = (reservaId: number, conductorId: string, aceptar: boolean) =>
  pedir<{ reserva: Reserva; imagenQR: string | null }>(
    `/reservas/${reservaId}/${aceptar ? 'aceptar' : 'rechazar'}`,
    'POST',
    { conductorId }
  );

export const misReservas = (correo: string) =>
  pedir<ReservaConQR[]>(`/usuarios/${correo}/reservas`);

export const validarAbordaje = (viajeId: number, codigo: string) =>
  pedir<{ mensaje: string; reserva: Reserva }>(`/viajes/${viajeId}/abordar`, 'POST', { codigo });

// ---------- Emergencia (Reto 2) ----------
export async function obtenerContacto(correo: string): Promise<Contacto | null> {
  try {
    return await pedir<Contacto>(`/usuarios/${correo}/contacto-emergencia`);
  } catch {
    return null; // todavía no ha registrado contacto
  }
}

export const guardarContacto = (correo: string, nombre: string, telefono: string) =>
  pedir<Contacto>(`/usuarios/${correo}/contacto-emergencia`, 'PUT', { nombre, telefono });

export const activarAlerta = (usuarioId: string, viajeId?: number, ubicacion?: { lat: number; lon: number } | null) =>
  pedir<ResultadoAlerta>('/emergencias', 'POST', { usuarioId, viajeId, ubicacion: ubicacion ?? undefined });
