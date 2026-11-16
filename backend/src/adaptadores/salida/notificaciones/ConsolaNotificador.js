// adaptadores/salida/notificaciones/ConsolaNotificador.js
// Simula el envío de un correo imprimiendo en consola (viene del Corte 1).
// También envía el código de verificación del correo y es el canal de respaldo
// de las alertas de emergencia.
const INotificador = require('../../../puertos/INotificador');

class ConsolaNotificador extends INotificador {
    notificar(viaje, mensaje, destinatario) {
        let para = viaje ? viaje.conductorId : '';
        if (destinatario) {
            para = destinatario.correo || destinatario.nombre;
        }
        const referencia = viaje ? ` - Viaje #${viaje.id}` : '';
        console.log(`[EMAIL a ${para}${referencia}] ${mensaje}`);
    }
}

module.exports = ConsolaNotificador;
