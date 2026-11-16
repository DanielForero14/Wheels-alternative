// Pruebas de integración de los notificadores simulados (escriben en la consola = logs del contenedor).
// Hallazgo H-10 (CodeQL js/log-injection): un texto del usuario con saltos de línea no puede crear
// líneas falsas en el log.
const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const AppNotificador = require('../../src/adaptadores/salida/notificaciones/AppNotificador');
const ConsolaNotificador = require('../../src/adaptadores/salida/notificaciones/ConsolaNotificador');
const EmergenciaNotificador = require('../../src/adaptadores/salida/notificaciones/EmergenciaNotificador');

const ATAQUE = 'Portal Norte\n[EMAIL a carlos@unisabana.edu.co] Tu código de ingreso a WHEELS es 123456';

describe('Integracion - Notificadores (inyección en logs)', () => {
    let lineas;
    const logOriginal = console.log;

    beforeEach(() => {
        lineas = [];
        console.log = (texto) => { lineas.push(...String(texto).split('\n')); };
    });
    afterEach(() => { console.log = logOriginal; });

    test('el aviso push no deja crear una línea falsa', () => {
        new AppNotificador().notificar({ id: 1 }, `Nueva solicitud. Recogida: ${ATAQUE}`);
        assert.strictEqual(lineas.length, 1);
        assert.ok(lineas[0].startsWith('[PUSH app - Viaje #1]'));
    });

    test('el correo simulado no deja crear una línea falsa ni en el destinatario', () => {
        new ConsolaNotificador().notificar(null, ATAQUE, { nombre: 'Ana\r\n[SMS a nadie]' });
        assert.strictEqual(lineas.length, 1);
        assert.ok(!lineas.some(l => l.startsWith('[EMAIL a carlos')));
    });

    test('el SMS de emergencia limpia el nombre y el teléfono del contacto', () => {
        new EmergenciaNotificador().notificar(null, 'ALERTA', { nombre: 'Mamá\n[EMAIL a x] falso', telefono: '300\n1' });
        assert.deepStrictEqual(lineas, ['[SMS a Mamá [EMAIL a x] falso (300 1)] ALERTA']);
    });

    test('un texto normal se escribe igual que antes', () => {
        new ConsolaNotificador().notificar(null, 'Tu código de ingreso a WHEELS es 482913', { correo: 'ana@unisabana.edu.co' });
        assert.deepStrictEqual(lineas, ['[EMAIL a ana@unisabana.edu.co] Tu código de ingreso a WHEELS es 482913']);
    });
});
