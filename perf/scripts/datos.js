// perf/scripts/datos.js
// Funciones compartidas por los scripts de carga.
// La API debe estar corriendo con "npm run start:carga", que ya trae
// un conductor verificado y 500 viajes en los próximos 7 días.
import http from 'k6/http';

// Se usa 127.0.0.1 y no "localhost": en Windows, k6 puede traducir localhost a IPv6 y no conectar.
export const API = __ENV.API || 'http://127.0.0.1:3000';
export const ORIGENES = ['Chía', 'Cajicá', 'Zipaquirá', 'Cota', 'Suba'];
export const CONDUCTOR_PRUEBA = 'conductor.prueba@unisabana.edu.co';
export const JSON_HEADERS = { headers: { 'Content-Type': 'application/json' } };

// Fechas de los próximos 7 días (AAAA-MM-DD), las mismas de los datos de prueba
export function proximosDias() {
    const dias = [];
    for (let i = 1; i <= 7; i++) {
        const fecha = new Date(Date.now() + i * 24 * 60 * 60 * 1000);
        const mes = String(fecha.getMonth() + 1).padStart(2, '0');
        const dia = String(fecha.getDate()).padStart(2, '0');
        dias.push(`${fecha.getFullYear()}-${mes}-${dia}`);
    }
    return dias;
}

// Ids de los viajes de prueba
export function idsDeViajes() {
    const respuesta = http.get(`${API}/usuarios/${CONDUCTOR_PRUEBA}/viajes`);
    return respuesta.json().map(v => v.id);
}

export function aleatorio(lista) {
    return lista[Math.floor(Math.random() * lista.length)];
}
