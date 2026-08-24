// backend/src/modelo/Viaje.js
// Representa un viaje universitario. Es la clase base del dominio.
class Viaje {
    constructor(id, conductorId, puntoInicio, puntoFinal, hora, cuposDisponibles) {
        this.id = id;
        this.conductorId = conductorId;
        this.puntoInicio = puntoInicio;
        this.puntoFinal = puntoFinal;
        this.hora = hora;
        this.cuposDisponibles = cuposDisponibles;
        this.estado = 'disponible'; // disponible | lleno | cancelado
    }

    reservarCupo() {
        if (this.cuposDisponibles <= 0) {
            throw new Error('No hay cupos disponibles');
        }
        this.cuposDisponibles -= 1;
        if (this.cuposDisponibles === 0) {
            this.estado = 'lleno';
        }
    }

    cancelar() {
        this.estado = 'cancelado';
    }
}

module.exports = Viaje;
