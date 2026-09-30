// puertos/IServicioRutas.js
// Puerto de salida para ubicar direcciones y calcular rutas (Reto 3: tiempo estimado).
// El núcleo no sabe si detrás hay OpenStreetMap, Google o un cálculo aproximado.
class IServicioRutas {
    get nombre() {
        return this.constructor.name;
    }

    // "Universidad de La Sabana" -> { lat, lon }
    async buscarCoordenadas(direccion) {
        throw new Error('El método buscarCoordenadas() debe ser implementado');
    }

    // origen y destino: { lat, lon } -> { distanciaKm, minutos }
    async calcularRuta(origen, destino) {
        throw new Error('El método calcularRuta() debe ser implementado');
    }
}

module.exports = IServicioRutas;
