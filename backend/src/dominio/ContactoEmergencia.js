// dominio/ContactoEmergencia.js
// Persona de confianza que recibe las alertas de un usuario (Reto 2).
class ContactoEmergencia {
    constructor(usuarioId, nombre, telefono) {
        if (!usuarioId || !nombre || !telefono) {
            throw new Error('Faltan datos del contacto de emergencia');
        }
        // Solo números, entre 7 y 15 dígitos.
        if (!/^\d{7,15}$/.test(String(telefono))) {
            throw new Error('El teléfono debe tener entre 7 y 15 dígitos');
        }
        this.usuarioId = usuarioId;
        this.nombre = nombre;
        this.telefono = String(telefono);
    }
}

module.exports = ContactoEmergencia;
