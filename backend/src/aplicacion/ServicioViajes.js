// aplicacion/ServicioViajes.js
// Casos de uso de viajes: programar, listar, buscar y cancelar (Reto 3).
// Antes se llamaba GestorViajes. Ahora no guarda la lista él mismo:
// usa el puerto IRepositorioViajes. Sigue siendo el "Subject" del Observer.
const ViajeFactory = require('../dominio/ViajeFactory');

class ServicioViajes {
    constructor(repositorio, servicioUsuarios, notificadores = []) {
        this.repositorio = repositorio;           // IRepositorioViajes
        this.servicioUsuarios = servicioUsuarios; // para exigir usuarios verificados
        this.notificadores = notificadores;       // lista de INotificador
    }

    programarViaje(datos, hoy) {
        this.servicioUsuarios.exigirUsuarioVerificado(datos.conductorId, 'conductor');
        const viaje = ViajeFactory.crearViaje(datos, hoy);
        return this.repositorio.guardarViaje(viaje);
    }

    buscarViajes(filtros = {}) {
        return this.repositorio.buscarViajes(filtros);
    }

    viajesDelConductor(conductorId) {
        return this.repositorio.buscarViajesDeConductor(conductorId);
    }

    cancelarViaje(viajeId) {
        const viaje = this.repositorio.buscarViajePorId(viajeId);
        if (!viaje) {
            throw new Error('Viaje no encontrado');
        }
        viaje.cancelar();
        this.repositorio.actualizarViaje(viaje);
        this.notificadores.forEach(n => n.notificar(viaje, 'El viaje fue cancelado.'));
        return viaje;
    }
}

module.exports = ServicioViajes;
