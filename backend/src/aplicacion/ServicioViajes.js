// aplicacion/ServicioViajes.js
// Casos de uso de viajes: registrar el vehículo, programar, listar, buscar y cancelar (Reto 3).
// Antes se llamaba GestorViajes. Ahora no guarda la lista él mismo:
// usa el puerto IRepositorioViajes. Sigue siendo el "Subject" del Observer.
const ViajeFactory = require('../dominio/ViajeFactory');
const Vehiculo = require('../dominio/Vehiculo');

class ServicioViajes {
    constructor(repositorio, servicioUsuarios, notificadores = []) {
        this.repositorio = repositorio;           // IRepositorioViajes
        this.servicioUsuarios = servicioUsuarios; // para exigir usuarios verificados
        this.notificadores = notificadores;       // lista de INotificador
    }

    // El conductor registra (o cambia) la placa y la descripción de su carro.
    registrarVehiculo(conductorId, placa, descripcion) {
        this.servicioUsuarios.exigirUsuarioVerificado(conductorId, 'conductor');
        return this.repositorio.guardarVehiculo(new Vehiculo(conductorId, placa, descripcion));
    }

    vehiculoDelConductor(conductorId) {
        return this.repositorio.buscarVehiculo(conductorId);
    }

    programarViaje(datos, hoy) {
        this.servicioUsuarios.exigirUsuarioVerificado(datos.conductorId, 'conductor');
        // Sin vehículo el pasajero no sabría a qué carro subirse.
        if (!this.repositorio.buscarVehiculo(datos.conductorId)) {
            throw new Error('Primero registra la información de tu vehículo');
        }
        const viaje = ViajeFactory.crearViaje(datos, hoy);
        return this.repositorio.guardarViaje(viaje);
    }

    // Cada viaje va con el nombre del conductor. La placa no: esa solo la ve el pasajero aceptado.
    buscarViajes(filtros = {}) {
        const nombres = new Map(); // para no buscar el mismo conductor varias veces
        return this.repositorio.buscarViajes(filtros).map(viaje => {
            if (!nombres.has(viaje.conductorId)) {
                const conductor = this.repositorio.buscarUsuario(viaje.conductorId);
                nombres.set(viaje.conductorId, conductor ? conductor.nombre : viaje.conductorId);
            }
            return { ...viaje, conductorNombre: nombres.get(viaje.conductorId) };
        });
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
