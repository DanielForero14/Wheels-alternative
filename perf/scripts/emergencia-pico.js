// perf/scripts/emergencia-pico.js
// Reto 2 (contacto de emergencia) - Prueba de PICO.
// Muchas alertas llegan de golpe (por ejemplo, un accidente en la vía):
// pasa de 0 a 100 usuarios en 10 segundos.
// SLO definido antes de ejecutar: p95 <= 500 ms y errores < 1 %
// (ninguna alerta puede quedarse sin enviar).
import http from 'k6/http';
import { check, sleep } from 'k6';
import { API, JSON_HEADERS, idsDeViajes, aleatorio } from './datos.js';

const USUARIOS = 100;

export const options = {
    stages: [
        { duration: '10s', target: USUARIOS }, // pico repentino
        { duration: '30s', target: USUARIOS }, // se mantiene
        { duration: '10s', target: 0 },        // baja
    ],
    thresholds: {
        http_req_duration: ['p(95)<=500'],
        http_req_failed: ['rate<0.01'],
        checks: ['rate>0.99'],
    },
};

export function setup() {
    const datos = { ids: idsDeViajes() };
    for (let i = 1; i <= USUARIOS; i++) {
        const contacto = { nombre: `Contacto ${i}`, telefono: '3001234567' };
        http.put(`${API}/usuarios/usuario${i}@unisabana.edu.co/contacto-emergencia`, JSON.stringify(contacto), JSON_HEADERS);
    }
    return datos;
}

export default function (datos) {
    const alerta = { usuarioId: `usuario${__VU}@unisabana.edu.co`, viajeId: aleatorio(datos.ids) };
    const respuesta = http.post(`${API}/emergencias`, JSON.stringify(alerta), JSON_HEADERS);
    check(respuesta, { 'alerta enviada': (r) => r.status === 200 && r.json('enviada') === true });
    sleep(1);
}
