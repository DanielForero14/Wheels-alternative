// perf/scripts/busqueda-baseline.js
// Reto 3 (planeación de viajes) - Prueba BASELINE.
// Pocos usuarios (10) durante 1 minuto: sirve como punto de comparación.
// SLO definido antes de ejecutar: p95 <= 500 ms y errores < 1 %.
import http from 'k6/http';
import { check, sleep } from 'k6';
import { API, ORIGENES, proximosDias, aleatorio } from './datos.js';

export const options = {
    vus: 10,
    duration: '1m',
    thresholds: {
        http_req_duration: ['p(95)<=500'],
        http_req_failed: ['rate<0.01'],
    },
};

export function setup() {
    return { dias: proximosDias() };
}

export default function (datos) {
    const fecha = aleatorio(datos.dias);
    const origen = aleatorio(ORIGENES);
    const respuesta = http.get(`${API}/viajes?fecha=${fecha}&origen=${encodeURIComponent(origen)}`);
    check(respuesta, { 'respuesta 200': (r) => r.status === 200 });
    sleep(1);
}
