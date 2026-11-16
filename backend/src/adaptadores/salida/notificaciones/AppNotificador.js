// adaptadores/salida/notificaciones/AppNotificador.js
// Simula una notificación push dentro de la app (viene del Corte 1).
const INotificador = require('../../../puertos/INotificador');
const textoParaLog = require('./textoParaLog');

class AppNotificador extends INotificador {
    notificar(viaje, mensaje) {
        console.log(`[PUSH app - Viaje #${viaje.id}] ${textoParaLog(mensaje)}`);
    }
}

module.exports = AppNotificador;
