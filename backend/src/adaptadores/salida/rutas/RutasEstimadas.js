// adaptadores/salida/rutas/RutasEstimadas.js
// Respaldo de IServicioRutas: funciona sin internet.
// - Las direcciones se buscan en una lista de lugares conocidos de la zona.
// - La distancia se calcula en línea recta (fórmula de Haversine) y se ajusta
//   con un factor porque las calles no son rectas. El tiempo usa una velocidad promedio.
const IServicioRutas = require('../../../puertos/IServicioRutas');

const FACTOR_CALLES = 1.3;          // la ruta real suele ser ~30 % más larga que la línea recta
const VELOCIDAD_PROMEDIO_KMH = 30;  // velocidad promedio en la Sabana y el norte de Bogotá

// Coordenadas aproximadas (centro de cada lugar)
const LUGARES_CONOCIDOS = [
    { nombres: ['universidad de la sabana', 'unisabana', 'la sabana', 'universidad'], lat: 4.8616, lon: -74.0325 },
    { nombres: ['zipaquira'], lat: 5.0221, lon: -74.0048 },
    { nombres: ['cajica'], lat: 4.9186, lon: -74.0283 },
    { nombres: ['chia'], lat: 4.8617, lon: -74.0584 },
    { nombres: ['cota'], lat: 4.8094, lon: -74.1017 },
    { nombres: ['portal norte', 'calle 170', 'calle 134', 'usaquen'], lat: 4.7546, lon: -74.0463 },
    { nombres: ['suba'], lat: 4.7412, lon: -74.0839 },
    { nombres: ['bogota'], lat: 4.7110, lon: -74.0721 },
];

function sinTildes(texto) {
    return texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function distanciaLineaRectaKm(a, b) {
    const radioTierra = 6371;
    const aRad = (grados) => (grados * Math.PI) / 180;
    const dLat = aRad(b.lat - a.lat);
    const dLon = aRad(b.lon - a.lon);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(aRad(a.lat)) * Math.cos(aRad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * radioTierra * Math.asin(Math.sqrt(h));
}

class RutasEstimadas extends IServicioRutas {
    async buscarCoordenadas(direccion) {
        const texto = sinTildes(direccion);
        const lugar = LUGARES_CONOCIDOS.find(l => l.nombres.some(nombre => texto.includes(nombre)));
        if (!lugar) {
            throw new Error(`No se encontró la dirección "${direccion}"`);
        }
        return { lat: lugar.lat, lon: lugar.lon };
    }

    async calcularRuta(origen, destino) {
        const distanciaKm = distanciaLineaRectaKm(origen, destino) * FACTOR_CALLES;
        return { distanciaKm, minutos: (distanciaKm / VELOCIDAD_PROMEDIO_KMH) * 60 };
    }
}

RutasEstimadas.distanciaLineaRectaKm = distanciaLineaRectaKm;
module.exports = RutasEstimadas;
