// backend/src/modelo/GestorViajes.js
// Actúa como "Subject" del patrón Observer.
// SRP: esta clase solo gestiona el ciclo de vida de los viajes,
// no sabe CÓMO se notifica (eso lo delega a INotificador).
// DIP: depende de la abstracción INotificador, no de una implementación concreta.
class GestorViajes {
    constructor() {
        this.viajes = [];
        this.observadores = []; // lista de INotificador
    }

    agregarObservador(notificador) {
        this.observadores.push(notificador);
    }

    agregarViaje(viaje) {
        this.viajes.push(viaje);
    }

    listarDisponibles() {
        return this.viajes.filter(v => v.estado === 'disponible');
    }

    reservarViaje(viajeId) {
        const viaje = this.viajes.find(v => v.id === viajeId);
        if (!viaje) {
            throw new Error('Viaje no encontrado');
        }

        viaje.reservarCupo();
        this._notificarTodos(viaje, `Se reservó un cupo. Cupos restantes: ${viaje.cuposDisponibles}`);

        if (viaje.estado === 'lleno') {
            this._notificarTodos(viaje, 'El viaje quedó lleno.');
        }

        return viaje;
    }

    cancelarViaje(viajeId) {
        const viaje = this.viajes.find(v => v.id === viajeId);
        if (!viaje) {
            throw new Error('Viaje no encontrado');
        }
        viaje.cancelar();
        this._notificarTodos(viaje, 'El viaje fue cancelado.');
        return viaje;
    }

    _notificarTodos(viaje, mensaje) {
        this.observadores.forEach(obs => obs.notificar(viaje, mensaje));
    }
}

module.exports = GestorViajes;
