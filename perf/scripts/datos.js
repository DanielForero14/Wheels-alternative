// perf/scripts/datos.js
// Funciones compartidas por los scripts de carga.
// La API debe estar corriendo con "npm run start:carga", que ya trae
// un conductor verificado y 500 viajes en los próximos 7 días.
import http from 'k6/http';
import crypto from 'k6/crypto';
import encoding from 'k6/encoding';

// Se usa 127.0.0.1 y no "localhost": en Windows, k6 puede traducir localhost a IPv6 y no conectar.
export const API = __ENV.API || 'http://127.0.0.1:3000';
export const ORIGENES = ['Chía', 'Cajicá', 'Zipaquirá', 'Cota', 'Suba'];
export const CONDUCTOR_PRUEBA = 'conductor.prueba@unisabana.edu.co';

// Desde el Corte 3 la API exige un token de sesión. Como el código de ingreso llega por "correo",
// k6 firma su propio token con la misma clave que la API (variable SECRETO_TOKEN, igual en los dos):
//   k6 run -e SECRETO_TOKEN=<la misma clave de la API> perf/scripts/<script>.js
// El formato es el de backend/src/adaptadores/entrada/http/tokens.js: <datos base64url>.<HMAC-SHA256 base64url>
const SECRETO = __ENV.SECRETO_TOKEN;

export function tokenPara(correo, rol) {
    if (!SECRETO) {
        throw new Error('Falta SECRETO_TOKEN: ejecute k6 con -e SECRETO_TOKEN=<la misma clave de la API>');
    }
    const contenido = { correo, rol, exp: Date.now() + 2 * 60 * 60 * 1000 };
    const datos = encoding.b64encode(JSON.stringify(contenido), 'rawurl');
    return `${datos}.${crypto.hmac('sha256', SECRETO, datos, 'base64rawurl')}`;
}

// Cabeceras para actuar como un usuario: JSON + token de sesión.
export function sesion(correo, rol = 'pasajero') {
    return {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenPara(correo, rol)}` },
    };
}

export const PASAJERO_PRUEBA = 'pasajero.prueba@unisabana.edu.co';

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
    const respuesta = http.get(`${API}/usuarios/${CONDUCTOR_PRUEBA}/viajes`, sesion(CONDUCTOR_PRUEBA, 'conductor'));
    return respuesta.json().map(v => v.id);
}

export function aleatorio(lista) {
    return lista[Math.floor(Math.random() * lista.length)];
}
