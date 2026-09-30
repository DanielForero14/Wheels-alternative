// perf/scripts/tiempo-estimado.js
// Reto 3 (tiempo estimado hasta el destino) - Prueba de CARGA para medir el efecto del caché.
// 50 usuarios piden cuánto se demoran desde 5 puntos de salida comunes hasta la universidad.
// La API corre con un servicio de rutas simulado que tarda 300 ms, como uno real por internet.
// Se ejecuta dos veces:
//   1) API con "npm run start:carga-sin-cache"  -> sin caché
//   2) API con "npm run start:carga"            -> con caché
// SLO definido antes de ejecutar: p95 <= 500 ms y errores < 1 %.
import http from 'k6/http';
import { check, sleep } from 'k6';
import { API, idsDeViajes, aleatorio } from './datos.js';

// Puntos de salida frecuentes (Portal Norte, Chía, Cajicá, Cota, Suba)
const PUNTOS_DE_SALIDA = [
    { lat: 4.7546, lon: -74.0463 },
    { lat: 4.8617, lon: -74.0584 },
    { lat: 4.9186, lon: -74.0283 },
    { lat: 4.8094, lon: -74.1017 },
    { lat: 4.7412, lon: -74.0839 },
];

export const options = {
    vus: 50,
    duration: '1m',
    thresholds: {
        http_req_duration: ['p(95)<=500'],
        http_req_failed: ['rate<0.01'],
    },
};

export function setup() {
    return { ids: idsDeViajes() };
}

export default function (datos) {
    const punto = aleatorio(PUNTOS_DE_SALIDA);
    const viajeId = aleatorio(datos.ids);
    const respuesta = http.get(`${API}/viajes/${viajeId}/tiempo-estimado?lat=${punto.lat}&lon=${punto.lon}`);
    check(respuesta, { 'tiempo calculado': (r) => r.status === 200 && r.json('minutos') > 0 });
    sleep(1);
}
