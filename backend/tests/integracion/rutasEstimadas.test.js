// Prueba de integración: puerto IServicioRutas + adaptador de respaldo RutasEstimadas.
// (El adaptador de OpenStreetMap necesita internet; se prueba a mano con la app.)
const { describe, test } = require('node:test');
const assert = require('node:assert');
const RutasEstimadas = require('../../src/adaptadores/salida/rutas/RutasEstimadas');

describe('Integracion - RutasEstimadas (respaldo sin internet)', () => {
    const rutas = new RutasEstimadas();

    test('reconoce lugares conocidos aunque tengan tildes o mayúsculas', async () => {
        const conTilde = await rutas.buscarCoordenadas('Parque principal de Chía');
        const sinTilde = await rutas.buscarCoordenadas('CHIA centro');
        assert.deepStrictEqual(conTilde, sinTilde);
        assert.ok(Math.abs(conTilde.lat - 4.86) < 0.05);
    });

    test('una dirección desconocida lanza error', async () => {
        await assert.rejects(rutas.buscarCoordenadas('Medellín'), /No se encontró la dirección/);
    });

    test('la distancia en línea recta entre dos puntos conocidos es correcta', () => {
        // Portal Norte -> Universidad de La Sabana: unos 12 km en línea recta
        const km = RutasEstimadas.distanciaLineaRectaKm({ lat: 4.7546, lon: -74.0463 }, { lat: 4.8616, lon: -74.0325 });
        assert.ok(km > 11.5 && km < 12.5, `dio ${km}`);
    });

    test('la ruta estimada aplica el factor de calles y la velocidad promedio', async () => {
        const origen = { lat: 4.7546, lon: -74.0463 };
        const destino = { lat: 4.8616, lon: -74.0325 };
        const recta = RutasEstimadas.distanciaLineaRectaKm(origen, destino);

        const ruta = await rutas.calcularRuta(origen, destino);

        assert.ok(Math.abs(ruta.distanciaKm - recta * 1.3) < 0.001);
        assert.ok(Math.abs(ruta.minutos - (ruta.distanciaKm / 30) * 60) < 0.001);
    });

    test('mismo origen y destino da distancia cero (valor límite)', async () => {
        const punto = { lat: 4.8616, lon: -74.0325 };
        const ruta = await rutas.calcularRuta(punto, punto);
        assert.strictEqual(ruta.distanciaKm, 0);
    });
});
