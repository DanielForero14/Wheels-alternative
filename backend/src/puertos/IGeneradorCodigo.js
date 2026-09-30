// puertos/IGeneradorCodigo.js
// Puerto de salida para crear códigos (Reto 1):
// - el código de una reserva y su imagen QR
// - el código numérico que se envía al correo para verificar al estudiante
// El núcleo no sabe qué librería se usa para dibujar el QR.
class IGeneradorCodigo {
    generarCodigo() {
        throw new Error('El método generarCodigo() debe ser implementado');
    }

    generarCodigoNumerico(digitos) {
        throw new Error('El método generarCodigoNumerico() debe ser implementado');
    }

    async generarImagenQR(codigo) {
        throw new Error('El método generarImagenQR() debe ser implementado');
    }
}

module.exports = IGeneradorCodigo;
