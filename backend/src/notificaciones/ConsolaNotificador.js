// backend/src/notificaciones/ConsolaNotificador.js
// Implementación concreta: simula el envío de un correo, imprimiendo en consola.
const INotificador = require('./INotificador');

class ConsolaNotificador extends INotificador {
    notificar(viaje, mensaje) {
        console.log(`[EMAIL a conductor ${viaje.conductorId}] ${mensaje}`);
    }
}

module.exports = ConsolaNotificador;
