// adaptadores/salida/notificaciones/EmergenciaNotificador.js
// Canal principal de las alertas de emergencia: simula un SMS (Reto 2).
// Con "simularFalla" se puede demostrar que la alerta pasa al canal de respaldo.
const INotificador = require('../../../puertos/INotificador');

class EmergenciaNotificador extends INotificador {
    constructor(simularFalla = false) {
        super();
        this.simularFalla = simularFalla;
    }

    notificar(viaje, mensaje, destinatario) {
        if (this.simularFalla) {
            throw new Error('El servicio de SMS no responde');
        }
        console.log(`[SMS a ${destinatario.nombre} (${destinatario.telefono})] ${mensaje}`);
    }
}

module.exports = EmergenciaNotificador;
