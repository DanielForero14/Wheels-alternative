// adaptadores/salida/qr/GeneradorCodigoQR.js
// Implementa el puerto IGeneradorCodigo (Reto 1).
// - El código de la reserva es un texto aleatorio imposible de adivinar (crypto de Node).
// - El código de verificación del correo son 6 dígitos al azar.
// - La imagen QR se dibuja con la librería "qrcode" y se devuelve como imagen base64.
const crypto = require('crypto');
const QRCode = require('qrcode');
const IGeneradorCodigo = require('../../../puertos/IGeneradorCodigo');

class GeneradorCodigoQR extends IGeneradorCodigo {
    generarCodigo() {
        return crypto.randomUUID();
    }

    // Ej.: con 6 dígitos devuelve un texto como "048213".
    generarCodigoNumerico(digitos) {
        let codigo = '';
        for (let i = 0; i < digitos; i++) {
            codigo += crypto.randomInt(0, 10);
        }
        return codigo;
    }

    async generarImagenQR(codigo) {
        return QRCode.toDataURL(codigo);
    }
}

module.exports = GeneradorCodigoQR;
