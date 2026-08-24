// backend/src/factoria/ViajeFactory.js
// Patrón Factory Method: centraliza la creación de Viajes,
// generando el ID y validando los datos, sin que el código
// cliente conozca los detalles de construcción.
const Viaje = require('../modelo/Viaje');

let contadorId = 1;

class ViajeFactory {
    static crearViaje({ conductorId, puntoInicio, puntoFinal, hora, cuposDisponibles }) {
        if (!conductorId || !puntoInicio || !puntoFinal || !hora) {
            throw new Error('Faltan datos obligatorios para crear el viaje');
        }
        const id = contadorId++;
        return new Viaje(id, conductorId, puntoInicio, puntoFinal, hora, cuposDisponibles);
    }
}

module.exports = ViajeFactory;