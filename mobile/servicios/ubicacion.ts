// servicios/ubicacion.ts
// Obtiene la ubicación actual del celular (o del navegador) con permiso del usuario.
import * as Location from 'expo-location';

export type Ubicacion = { lat: number; lon: number };

// Devuelve null si el usuario no da permiso o no se puede obtener la ubicación.
export async function obtenerUbicacion(): Promise<Ubicacion | null> {
  try {
    const permiso = await Location.requestForegroundPermissionsAsync();
    if (permiso.status !== 'granted') {
      return null;
    }
    const posicion = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: posicion.coords.latitude, lon: posicion.coords.longitude };
  } catch {
    return null;
  }
}
