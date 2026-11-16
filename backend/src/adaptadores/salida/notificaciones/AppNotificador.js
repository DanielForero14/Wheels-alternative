// adaptadores/salida/notificaciones/AppNotificador.js
// Simula una notificación push dentro de la app (viene del Corte 1).
const INotificador = require('../../../puertos/INotificador');

class AppNotificador extends INotificador {
    notificar(viaje, mensaje) {
        console.log(`[PUSH app - Viaje #${viaje.id}] ${mensaje}`);
    }
}

module.exports = AppNotificador;
