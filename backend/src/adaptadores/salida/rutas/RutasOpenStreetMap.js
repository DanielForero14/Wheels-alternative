// adaptadores/salida/rutas/RutasOpenStreetMap.js
// Implementa IServicioRutas con servicios gratuitos de OpenStreetMap:
// - Nominatim: convierte una dirección escrita en coordenadas.
// - OSRM: calcula la ruta en carro por las calles (distancia y duración, sin tráfico en vivo).
const IServicioRutas = require('../../../puertos/IServicioRutas');

const TIEMPO_MAXIMO_MS = 4000; // si el servicio no responde en 4 s, se usa el respaldo

class RutasOpenStreetMap extends IServicioRutas {
    async buscarCoordenadas(direccion) {
        const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=co&q=' +
            encodeURIComponent(direccion);
        const respuesta = await fetch(url, {
            headers: { 'User-Agent': 'WHEELS-proyecto-universitario/1.0' }, // Nominatim lo exige
            signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
        });
        const resultados = await respuesta.json();
        if (!respuesta.ok || resultados.length === 0) {
            throw new Error(`No se encontró la dirección "${direccion}"`);
        }
        return { lat: Number(resultados[0].lat), lon: Number(resultados[0].lon) };
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
