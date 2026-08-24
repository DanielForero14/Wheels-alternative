// backend/src/notificaciones/AppNotificador.js
// Segunda implementación: simula una notificación push dentro de la app.
const INotificador = require('./INotificador');

class AppNotificador extends INotificador {
    notificar(viaje, mensaje) {
        console.log(`[PUSH app - Viaje #${viaje.id}] ${mensaje}`);
    }
}

module.exports = AppNotificador;
