// dominio/Viaje.js
// Entidad principal del dominio: un viaje publicado por un conductor.
// No depende de Express, de la base de datos ni de ninguna librería externa.
class Viaje {
    constructor(id, conductorId, puntoInicio, puntoFinal, fecha, hora, cuposDisponibles, estado = 'disponible', descripcionRuta = '') {
        this.id = id;
        this.conductorId = conductorId;
        this.puntoInicio = puntoInicio;
        this.puntoFinal = puntoFinal;
        this.fecha = fecha; // formato AAAA-MM-DD (Reto 3: planeación de viajes)
        this.hora = hora;   // formato HH:MM
        this.cuposDisponibles = cuposDisponibles;
        this.estado = estado; // disponible | lleno | cancelado
        this.descripcionRuta = descripcionRuta; // por dónde pasa, escrito por el conductor (ej. "Autopista hasta la 134")
    }

    reservarCupo() {
        if (this.estado === 'cancelado') {
            throw new Error('El viaje está cancelado');
        }
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
