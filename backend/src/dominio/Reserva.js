// dominio/Reserva.js
// Solicitud de cupo de un pasajero en un viaje.
// Estados: pendiente -> aceptada (tiene código QR) o rechazada.
// El código QR solo existe cuando el conductor acepta al pasajero (Reto 1).
const ESTADOS = ['pendiente', 'aceptada', 'rechazada'];

class Reserva {
    constructor(id, viajeId, pasajeroId, codigo, expira, usada = false, estado = 'aceptada', puntoRecogida = '') {
        if (!ESTADOS.includes(estado)) {
            throw new Error('Estado de reserva no válido');
        }
        this.id = id;
        this.viajeId = viajeId;
        this.pasajeroId = pasajeroId;
        this.codigo = codigo;               // texto aleatorio que se muestra como QR (null mientras esté pendiente)
        this.expira = expira;               // momento (en milisegundos) en que el código vence
        this.usada = usada;                 // true cuando el pasajero ya abordó
        this.estado = estado;
        this.puntoRecogida = puntoRecogida; // dónde recoger al pasajero, escrito por él
    }

    // Nueva solicitud: todavía sin código, esperando la respuesta del conductor.
    static solicitar(viajeId, pasajeroId, puntoRecogida) {
        const punto = String(puntoRecogida || '').trim();
        if (punto.length < 5) {
            throw new Error('Escribe dónde te recogen (mínimo 5 caracteres)');
        }
        if (punto.length > 150) {
            throw new Error('El punto de recogida no puede tener más de 150 caracteres');
        }
        return new Reserva(null, viajeId, pasajeroId, null, null, false, 'pendiente', punto);
    }

    aceptar(codigo, expira) {
        if (this.estado !== 'pendiente') {
            throw new Error('Esta solicitud ya fue respondida');
        }
        this.estado = 'aceptada';
        this.codigo = codigo;
        this.expira = expira;
    }

    rechazar() {
        if (this.estado !== 'pendiente') {
            throw new Error('Esta solicitud ya fue respondida');
        }
        this.estado = 'rechazada';
    }

    // Regla de seguridad: solo una reserva aceptada aborda, una sola vez y antes de vencer.
    marcarAbordaje(ahora) {
        if (this.estado !== 'aceptada') {
            throw new Error('El conductor no ha aceptado esta solicitud');
        }
        if (this.usada) {
            throw new Error('El código ya fue usado');
        }
        if (ahora > this.expira) {
            throw new Error('El código está vencido');
        }
        this.usada = true;
    }
}

module.exports = Reserva;
