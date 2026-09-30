// puertos/INotificador.js
// Puerto de salida para enviar avisos (viene del Corte 1, patrón Observer).
// En el Corte 2 se agrega el parámetro "destinatario" para las alertas de emergencia (Reto 2).
class INotificador {
    get nombre() {
        return this.constructor.name;
    }

    notificar(viaje, mensaje, destinatario) {
        throw new Error('El método notificar() debe ser implementado');
    }
}

module.exports = INotificador;
