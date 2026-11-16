// puertos/IRepositorioViajes.js
// Puerto de salida para guardar y consultar datos (Reto 3).
// El núcleo solo conoce estos métodos; no sabe si detrás hay memoria o SQLite.
class IRepositorioViajes {
    guardarViaje(viaje) { throw new Error('No implementado'); }
    actualizarViaje(viaje) { throw new Error('No implementado'); }
    buscarViajePorId(id) { throw new Error('No implementado'); }
    buscarViajes(filtros) { throw new Error('No implementado'); } // { fecha, origen, destino }
    buscarViajesDeConductor(conductorId) { throw new Error('No implementado'); }

    guardarReserva(reserva) { throw new Error('No implementado'); }
    actualizarReserva(reserva) { throw new Error('No implementado'); }
    buscarReservaPorCodigo(codigo) { throw new Error('No implementado'); }
    buscarReserva(viajeId, pasajeroId) { throw new Error('No implementado'); }
    buscarReservasDePasajero(pasajeroId) { throw new Error('No implementado'); }
    buscarReservasDeViaje(viajeId) { throw new Error('No implementado'); }
    buscarReservaPorId(id) { throw new Error('No implementado'); }

    guardarContacto(contacto) { throw new Error('No implementado'); }
    buscarContacto(usuarioId) { throw new Error('No implementado'); }

    guardarVehiculo(vehiculo) { throw new Error('No implementado'); }
    buscarVehiculo(conductorId) { throw new Error('No implementado'); }

    guardarUsuario(usuario) { throw new Error('No implementado'); }
    buscarUsuario(correo) { throw new Error('No implementado'); }
    guardarCodigoVerificacion(codigo) { throw new Error('No implementado'); }
    buscarCodigoVerificacion(correo) { throw new Error('No implementado'); }
    borrarCodigoVerificacion(correo) { throw new Error('No implementado'); }
}

module.exports = IRepositorioViajes;
