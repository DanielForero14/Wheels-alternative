// perf/slo.js
// Prueba de carga corta que verifica el SLO de WHEELS contra el entorno DESPLEGADO, después de cada despliegue.
// SLO del Corte 2 (docs/pruebas.md): p95 <= 500 ms y menos del 1 % de errores. Está escrito como umbrales
// (thresholds): si alguno no se cumple, k6 termina con código 99 y el paso del pipeline falla.
//
// Uso (con el sistema desplegado):
//   scripts/slo.sh                                   (prueba corta del pipeline: 30 s, 20 peticiones/s)
//   SLO_DURACION=5m SLO_TASA=60 scripts/slo.sh       (prueba larga, a mano o con carga-larga.yml)
//
// Qué mide: la búsqueda de viajes (Reto 3, la operación más frecuente del sistema).
// No usa "¿Cuánto me demoro?" porque en producción consulta los servidores públicos de OpenStreetMap,
// que limitan las peticiones (1 por segundo): esa ruta se midió en el Corte 2 con un servicio simulado
// (perf/scripts/tiempo-estimado.js).
import http from 'k6/http';
import { check } from 'k6';
import { sesion } from './scripts/datos.js';

const API = __ENV.API || 'http://127.0.0.1:3000';
// El conductor de la prueba de humo ya está verificado y tiene vehículo: se usa para crear viajes de ejemplo.
const CONDUCTOR = 'humo.conductor@unisabana.edu.co';
const PASAJERO = 'slo.pasajero@unisabana.edu.co';
const ORIGENES = ['Chía', 'Cajicá', 'Zipaquirá', 'Cota', 'Suba'];

export const options = {
    scenarios: {
        slo: {
            executor: 'constant-arrival-rate',
            rate: Number(__ENV.TASA || 20), // peticiones de búsqueda por segundo
            timeUnit: '1s',
            duration: __ENV.DURACION || '30s',
            preAllocatedVUs: 10,
            maxVUs: 60,
        },
    },
    // ---------- SLO (Corte 2) ----------
    thresholds: {
        http_req_duration: ['p(95)<=500'], // el 95 % de las peticiones responde en 500 ms o menos
        http_req_failed: ['rate<0.01'],    // menos del 1 % de las peticiones falla
        checks: ['rate>0.99'],
    },
};

function manana() {
    return new Date(Date.now() + 86400000).toISOString().slice(0, 10);
}

// Deja 5 viajes de mañana para que la búsqueda devuelva datos reales.
export function setup() {
    const cabeceras = sesion(CONDUCTOR, 'conductor');
    const ids = [];
    for (const origen of ORIGENES) {
        const viaje = { puntoInicio: origen, puntoFinal: 'Universidad', fecha: manana(), hora: '07:00', cuposDisponibles: 4 };
        const r = http.post(`${API}/viajes`, JSON.stringify(viaje), cabeceras);
        if (r.status === 201) {
            ids.push(r.json('id'));
        }
    }
    if (ids.length === 0) {
        throw new Error('No se pudieron crear viajes de ejemplo: ¿corrió antes la prueba de humo (conductor verificado)?');
    }
    return { ids, cabeceras: sesion(PASAJERO) };
}

export default function (datos) {
    const origen = ORIGENES[Math.floor(Math.random() * ORIGENES.length)];
    const r = http.get(`${API}/viajes?fecha=${manana()}&origen=${encodeURIComponent(origen)}`, {
        ...datos.cabeceras,
        tags: { name: 'GET /viajes (búsqueda)' },
    });
    check(r, { 'búsqueda responde 200': (res) => res.status === 200 });
}

// Cancela los viajes de ejemplo para no dejarlos en la base de datos de producción.
export function teardown(datos) {
    const cabeceras = sesion(CONDUCTOR, 'conductor');
    for (const id of datos.ids) {
        http.post(`${API}/viajes/${id}/cancelar`, null, cabeceras);
    }
}
