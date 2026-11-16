// aplicacion/ServicioReservas.js
// Casos de uso de reservas (Reto 1): el pasajero solicita un cupo con su punto de recogida,
// el conductor acepta o rechaza, y el QR del pasajero aceptado se valida al abordar.
const Reserva = require('../dominio/Reserva');

class ServicioReservas {
    constructor(repositorio, generadorCodigo, servicioUsuarios, notificadores = []) {
        this.repositorio = repositorio;           // IRepositorioViajes
        this.generadorCodigo = generadorCodigo;   // IGeneradorCodigo
        this.servicioUsuarios = servicioUsuarios; // para exigir usuarios verificados
        this.notificadores = notificadores;       // lista de INotificador
    }

    // El pasajero pide un cupo diciendo dónde lo recogen. Queda "pendiente" hasta que el conductor responda.
    solicitarCupo(viajeId, pasajeroId, puntoRecogida) {
        if (!pasajeroId) {
            throw new Error('Falta el pasajero que reserva');
        }
        this.servicioUsuarios.exigirUsuarioVerificado(pasajeroId, 'pasajero');
        const viaje = this.repositorio.buscarViajePorId(viajeId);
        if (!viaje) {
            throw new Error('Viaje no encontrado');
        }
        if (viaje.estado !== 'disponible') {
            throw new Error('El viaje ya no tiene cupos disponibles');
        }
        const anterior = this.repositorio.buscarReserva(viajeId, pasajeroId);
        if (anterior && anterior.estado !== 'rechazada') {
            throw new Error('Ya enviaste una solicitud para este viaje');
        }

        const reserva = this.repositorio.guardarReserva(Reserva.solicitar(viaje.id, pasajeroId, puntoRecogida));
        this._notificarTodos(viaje, `Nueva solicitud de ${pasajeroId}. Recogida: ${reserva.puntoRecogida}`);
        return reserva;
    }

    // El conductor acepta o rechaza. Si acepta, se ocupa el cupo y se genera el código QR.
    async responderSolicitud(reservaId, conductorId, aceptar) {
        const reserva = this.repositorio.buscarReservaPorId(reservaId);
        if (!reserva) {
            throw new Error('Solicitud no encontrada');
        }
        const viaje = this.repositorio.buscarViajePorId(reserva.viajeId);
        if (viaje.conductorId !== conductorId) {
            throw new Error('Solo el conductor del viaje puede responder la solicitud');
        }

        if (!aceptar) {
            reserva.rechazar();
            this.repositorio.actualizarReserva(reserva);
            return { reserva, imagenQR: null };
        }

        viaje.reservarCupo(); // falla si ya no hay cupos o el viaje fue cancelado
        // El código vence al terminar el día del viaje.
        reserva.aceptar(this.generadorCodigo.generarCodigo(), new Date(`${viaje.fecha}T23:59:59`).getTime());
        this.repositorio.actualizarViaje(viaje);
        this.repositorio.actualizarReserva(reserva);

        this._notificarTodos(viaje, `Solicitud aceptada. Cupos restantes: ${viaje.cuposDisponibles}`);
        if (viaje.estado === 'lleno') {
            this._notificarTodos(viaje, 'El viaje quedó lleno.');
        }
        return { reserva, imagenQR: await this.generadorCodigo.generarImagenQR(reserva.codigo) };
    }

    // Solicitudes que le llegaron al conductor en todos sus viajes (pantalla "Solicitudes").
    solicitudesDelConductor(conductorId) {
        const resultado = [];
        for (const viaje of this.repositorio.buscarViajesDeConductor(conductorId)) {
            for (const reserva of this.repositorio.buscarReservasDeViaje(viaje.id)) {
                const pasajero = this.repositorio.buscarUsuario(reserva.pasajeroId);
                resultado.push({ reserva, viaje, pasajero: pasajero ? pasajero.nombre : reserva.pasajeroId });
            }
        }
        return resultado;
    }

    // Reservas del pasajero con su viaje y el nombre del conductor (pantalla "Mis reservas").
    // La imagen QR y el vehículo (placa y descripción) solo van si el conductor aceptó.
    async reservasDelPasajero(pasajeroId) {
        const reservas = this.repositorio.buscarReservasDePasajero(pasajeroId);
        const resultado = [];
        for (const reserva of reservas) {
            const viaje = this.repositorio.buscarViajePorId(reserva.viajeId);
            const conductor = this.repositorio.buscarUsuario(viaje.conductorId);
            const conductorNombre = conductor ? conductor.nombre : viaje.conductorId;
            const aceptada = reserva.estado === 'aceptada';
            const imagenQR = aceptada ? await this.generadorCodigo.generarImagenQR(reserva.codigo) : null;
            const vehiculo = aceptada ? this.repositorio.buscarVehiculo(viaje.conductorId) : null;
            resultado.push({ reserva, viaje, conductorNombre, vehiculo, imagenQR });
        }
        return resultado;
    }

    // El conductor escanea el QR y envía el código que trae dentro.
    validarAbordaje(viajeId, codigo, ahora = Date.now()) {
        const reserva = this.repositorio.buscarReservaPorCodigo(codigo);
        if (!reserva) {
            throw new Error('Código inválido');
        }
        if (reserva.viajeId !== viajeId) {
            throw new Error('El código no pertenece a este viaje');
        }
        reserva.marcarAbordaje(ahora);
        this.repositorio.actualizarReserva(reserva);
        return reserva;
    }

    _notificarTodos(viaje, mensaje) {
        this.notificadores.forEach(n => n.notificar(viaje, mensaje));
    }
}

module.exports = ServicioReservas;
