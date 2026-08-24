// backend/src/notificaciones/INotificador.js
// Contrato (interfaz) que deben cumplir todos los notificadores.
// GestorViajes solo conoce este contrato, no las clases concretas.
class INotificador {
    notificar(viaje, mensaje) {
        throw new Error('El método notificar() debe ser implementado');
    }
}

module.exports = INotificador;