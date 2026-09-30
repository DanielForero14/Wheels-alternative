// adaptadores/salida/rutas/RutasSimuladasLentas.js
// Solo para las pruebas de carga: imita un servicio externo de rutas que tarda en responder.
// Así se mide el efecto del caché sin sobrecargar los servidores públicos de OpenStreetMap.
const RutasEstimadas = require('./RutasEstimadas');

const DEMORA_MS = 300; // tiempo típico de respuesta de un servicio de rutas por internet

const esperar = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class RutasSimuladasLentas extends RutasEstimadas {
    async buscarCoordenadas(direccion) {
        await esperar(DEMORA_MS);
        return super.buscarCoordenadas(direccion);
    }

    async calcularRuta(origen, destino) {
        await esperar(DEMORA_MS);
        return super.calcularRuta(origen, destino);
    }
}

module.exports = RutasSimuladasLentas;
