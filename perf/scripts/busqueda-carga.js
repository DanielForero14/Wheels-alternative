// perf/scripts/busqueda-carga.js
// Reto 3 (planeación de viajes) - Prueba de CARGA.
// Simula la semana de parciales: sube hasta 200 usuarios buscando viajes al mismo tiempo.
// SLO definido antes de ejecutar: p95 <= 500 ms y errores < 1 %.
import http from 'k6/http';
import { check, sleep } from 'k6';
import { API, ORIGENES, proximosDias, aleatorio } from './datos.js';

export const options = {
    stages: [
        { duration: '30s', target: 50 },  // sube a 50 usuarios
        { duration: '1m', target: 200 },  // sube a 200 usuarios
        { duration: '1m', target: 200 },  // se mantiene en 200
        { duration: '30s', target: 0 },   // baja
    ],
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
