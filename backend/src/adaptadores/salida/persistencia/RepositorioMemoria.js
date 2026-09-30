// adaptadores/salida/persistencia/RepositorioMemoria.js
// Implementa IRepositorioViajes guardando todo en listas (como en el Corte 1).
// Se usa como doble de prueba en las pruebas unitarias.
const IRepositorioViajes = require('../../../puertos/IRepositorioViajes');

class RepositorioMemoria extends IRepositorioViajes {
    constructor() {
        super();
        this.viajes = [];
        this.reservas = [];
        this.contactos = [];
        this.vehiculos = [];
        this.usuarios = [];
        this.codigos = [];
        this.siguienteId = 1;
    }

    guardarViaje(viaje) {
        viaje.id = this.siguienteId++;
        this.viajes.push(viaje);
        return viaje;
    }

    actualizarViaje(viaje) {
        return viaje; // en memoria el objeto ya quedó modificado
    }

    buscarViajePorId(id) {
        return this.viajes.find(v => v.id === id) || null;
    }

    buscarViajes({ fecha, origen, destino } = {}) {
        return this.viajes.filter(v =>
            v.estado === 'disponible' &&
            (!fecha || v.fecha === fecha) &&
            (!origen || v.puntoInicio.toLowerCase().includes(origen.toLowerCase())) &&
            (!destino || v.puntoFinal.toLowerCase().includes(destino.toLowerCase()))
        );
    }

    buscarViajesDeConductor(conductorId) {
        return this.viajes.filter(v => v.conductorId === conductorId);
    }

    guardarReserva(reserva) {
        reserva.id = this.siguienteId++;
        this.reservas.push(reserva);
        return reserva;
    }

    actualizarReserva(reserva) {
        return reserva;
    }

    buscarReservaPorCodigo(codigo) {
        return this.reservas.find(r => r.codigo === codigo) || null;
    }

    buscarReserva(viajeId, pasajeroId) {
        return this.reservas.find(r => r.viajeId === viajeId && r.pasajeroId === pasajeroId) || null;
    }

    buscarReservasDeViaje(viajeId) {
        return this.reservas.filter(r => r.viajeId === viajeId);
    }

    buscarReservaPorId(id) {
        return this.reservas.find(r => r.id === id) || null;
    }

    buscarReservasDePasajero(pasajeroId) {
        return this.reservas.filter(r => r.pasajeroId === pasajeroId);
    }

    guardarContacto(contacto) {
        this.contactos = this.contactos.filter(c => c.usuarioId !== contacto.usuarioId);
        this.contactos.push(contacto);
        return contacto;
    }

    buscarContacto(usuarioId) {
        return this.contactos.find(c => c.usuarioId === usuarioId) || null;
    }

    guardarVehiculo(vehiculo) {
        this.vehiculos = this.vehiculos.filter(v => v.conductorId !== vehiculo.conductorId);
        this.vehiculos.push(vehiculo);
        return vehiculo;
    }

    buscarVehiculo(conductorId) {
        return this.vehiculos.find(v => v.conductorId === conductorId) || null;
    }

    guardarUsuario(usuario) {
        this.usuarios = this.usuarios.filter(u => u.correo !== usuario.correo);
        this.usuarios.push(usuario);
        return usuario;
    }

    buscarUsuario(correo) {
        return this.usuarios.find(u => u.correo === correo) || null;
    }

    guardarCodigoVerificacion(codigo) {
        this.borrarCodigoVerificacion(codigo.correo);
        this.codigos.push(codigo);
        return codigo;
    }

    buscarCodigoVerificacion(correo) {
        return this.codigos.find(c => c.correo === correo) || null;
    }

    borrarCodigoVerificacion(correo) {
        this.codigos = this.codigos.filter(c => c.correo !== correo);
    }
}

module.exports = RepositorioMemoria;
