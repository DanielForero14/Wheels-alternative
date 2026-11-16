// dominio/ErrorDeAutorizacion.js
// Error de una regla de negocio de autorización: el usuario existe y ya se identificó,
// pero no le corresponde hacer esa acción (por ejemplo, cancelar el viaje de otro conductor).
// El adaptador HTTP lo traduce a 403; los demás errores del dominio son 400.
class ErrorDeAutorizacion extends Error {
    constructor(mensaje) {
        super(mensaje);
        this.name = 'ErrorDeAutorizacion';
    }
}

module.exports = ErrorDeAutorizacion;
