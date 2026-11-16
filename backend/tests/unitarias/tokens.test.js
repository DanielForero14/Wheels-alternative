// Pruebas unitarias del token de sesión (adaptadores/entrada/http/tokens.js).
// Cubren la amenaza de suplantación del modelo STRIDE: un token alterado, de otra clave o vencido no sirve.
const { describe, test } = require('node:test');
const assert = require('node:assert');
const { crearEmisorTokens } = require('../../src/adaptadores/entrada/http/tokens');

const SECRETO = 'a'.repeat(64);
const ANA = { correo: 'ana@unisabana.edu.co', rol: 'pasajero' };
const UNA_HORA = 60 * 60 * 1000;

describe('Unitaria - Token de sesión', () => {
    test('un token recién emitido identifica al usuario y su rol', () => {
        const emisor = crearEmisorTokens(SECRETO);
        const token = emisor.emitir(ANA, 0);
        assert.deepStrictEqual(emisor.verificar(token, 0), ANA);
    });

    test('vale justo hasta su vencimiento y se rechaza 1 ms después (valores límite)', () => {
        const emisor = crearEmisorTokens(SECRETO, UNA_HORA);
        const token = emisor.emitir(ANA, 0);
        assert.deepStrictEqual(emisor.verificar(token, UNA_HORA), ANA);
        assert.strictEqual(emisor.verificar(token, UNA_HORA + 1), null);
    });

    test('si se cambia el correo dentro del token, la firma ya no coincide', () => {
        const emisor = crearEmisorTokens(SECRETO);
        const [, firma] = emisor.emitir(ANA, 0).split('.');
        const datosFalsos = Buffer.from(JSON.stringify({ correo: 'carlos@unisabana.edu.co', rol: 'conductor', exp: UNA_HORA }))
            .toString('base64url');
        assert.strictEqual(emisor.verificar(`${datosFalsos}.${firma}`, 0), null);
    });

    test('un token firmado con otra clave se rechaza', () => {
        const token = crearEmisorTokens('b'.repeat(64)).emitir(ANA, 0);
        assert.strictEqual(crearEmisorTokens(SECRETO).verificar(token, 0), null);
    });

    test('tokens vacíos o mal formados se rechazan', () => {
        const emisor = crearEmisorTokens(SECRETO);
        for (const malo of [undefined, '', 'sin-punto', 'a.b.c', '.firma', 'datos.', '%%%.%%%']) {
            assert.strictEqual(emisor.verificar(malo, 0), null, `debería rechazar ${malo}`);
        }
    });

    test('una firma válida sobre datos que no son JSON se rechaza', () => {
        const crypto = require('crypto');
        const datos = Buffer.from('no es json').toString('base64url');
        const firma = crypto.createHmac('sha256', SECRETO).update(datos).digest('base64url');
        assert.strictEqual(crearEmisorTokens(SECRETO).verificar(`${datos}.${firma}`, 0), null);
    });

    test('no se puede crear con una clave corta (menos de 32 caracteres)', () => {
        assert.throws(() => crearEmisorTokens('corta'), /al menos 32/);
        assert.throws(() => crearEmisorTokens(undefined), /al menos 32/);
    });
});
