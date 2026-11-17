// adaptadores/salida/rutas/RutasOpenStreetMap.js
// Implementa IServicioRutas con servicios gratuitos de OpenStreetMap:
// - Nominatim: convierte una dirección escrita en coordenadas.
// - OSRM: calcula la ruta en carro por las calles (distancia y duración, sin tráfico en vivo).
const IServicioRutas = require('../../../puertos/IServicioRutas');

const TIEMPO_MAXIMO_MS = 4000; // si el servicio no responde en 4 s, se usa el respaldo
const ZONA_SERVICIO = { oeste: -74.25, norte: 5.15, este: -73.85, sur: 4.68 };

class RutasOpenStreetMap extends IServicioRutas {
    async buscarCoordenadas(direccion) {
        const { oeste, norte, este, sur } = ZONA_SERVICIO;
        const parametros = new URLSearchParams({
            format: 'json', limit: '1', countrycodes: 'co',
            viewbox: [oeste, norte, este, sur].join(','), bounded: '1', q: direccion,
        });
        const url = `https://nominatim.openstreetmap.org/search?${parametros}`;
        const respuesta = await fetch(url, {
            headers: { 'User-Agent': 'WHEELS-proyecto-universitario/1.0' }, // Nominatim lo exige
            signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
        });
        const resultados = await respuesta.json();
        const lugar = Array.isArray(resultados) ? resultados[0] : undefined;
        const lat = Number(lugar?.lat);
        const lon = Number(lugar?.lon);
        if (!respuesta.ok || !(lat >= sur && lat <= norte && lon >= oeste && lon <= este)) {
            throw new Error(`No se encontró la dirección "${direccion}"`);
        }
        return { lat, lon };
    }

    async calcularRuta(origen, destino) {
        // OSRM recibe las coordenadas como longitud,latitud
        const url = `https://router.project-osrm.org/route/v1/driving/` +
            `${origen.lon},${origen.lat};${destino.lon},${destino.lat}?overview=false`;
        const respuesta = await fetch(url, { signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS) });
        const datos = await respuesta.json();
        if (!respuesta.ok || datos.code !== 'Ok' || !datos.routes.length) {
            throw new Error('El servicio de rutas no pudo calcular la ruta');
        }
        return {
            distanciaKm: datos.routes[0].distance / 1000, // viene en metros
            minutos: datos.routes[0].duration / 60,       // viene en segundos
        };
    }
}

module.exports = RutasOpenStreetMap;
