// Prueba de integración: puerto IGeneradorCodigo + adaptador real con la librería "qrcode".
const { describe, test } = require('node:test');
const assert = require('node:assert');
const GeneradorCodigoQR = require('../../src/adaptadores/salida/qr/GeneradorCodigoQR');

describe('Integracion - GeneradorCodigoQR', () => {
    const generador = new GeneradorCodigoQR();

    test('genera códigos distintos cada vez', () => {
        const codigos = new Set();
        for (let i = 0; i < 1000; i++) {
            codigos.add(generador.generarCodigo());
        }
        assert.strictEqual(codigos.size, 1000);
    });

    test('genera la imagen del QR como imagen PNG en base64', async () => {
        const imagen = await generador.generarImagenQR(generador.generarCodigo());
        assert.match(imagen, /^data:image\/png;base64,/);
    });

    test('el código de verificación tiene 6 dígitos', () => {
        for (let i = 0; i < 100; i++) {
            assert.match(generador.generarCodigoNumerico(6), /^\d{6}$/);
        }
    });
});
