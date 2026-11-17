const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const RutasOpenStreetMap = require('../../src/adaptadores/salida/rutas/RutasOpenStreetMap');

describe('Integracion - RutasOpenStreetMap con respuestas HTTP controladas', () => {
    test('acota la geocodificación a la zona de servicio y convierte las coordenadas', async (t) => {
        const http = t.mock.method(globalThis, 'fetch', async () =>
            Response.json([{ lat: '4.8616', lon: '-74.0325' }]));

        const coordenadas = await new RutasOpenStreetMap().buscarCoordenadas('Universidad, Chía');

        assert.deepEqual(coordenadas, { lat: 4.8616, lon: -74.0325 });
        assert.equal(http.mock.callCount(), 1);
        const [direccion, opciones] = http.mock.calls[0].arguments;
        const url = new URL(direccion);
        assert.equal(url.origin, 'https://nominatim.openstreetmap.org');
        assert.equal(url.pathname, '/search');
        assert.deepEqual(Object.fromEntries(url.searchParams), {
            format: 'json', limit: '1', countrycodes: 'co',
            viewbox: '-74.25,5.15,-73.85,4.68', bounded: '1', q: 'Universidad, Chía',
        });
        assert.match(opciones.headers['User-Agent'], /WHEELS/);
        assert.ok(opciones.signal instanceof AbortSignal);
    });

    test('rechaza un resultado de Pereira aunque el proveedor lo devuelva', async (t) => {
        t.mock.method(globalThis, 'fetch', async () => Response.json([{ lat: '4.81', lon: '-75.68' }]));

        await assert.rejects(new RutasOpenStreetMap().buscarCoordenadas('Universidad'), /No se encontró/);
    });

    test('rechaza una búsqueda sin resultados', async (t) => {
        t.mock.method(globalThis, 'fetch', async () => Response.json([]));

        await assert.rejects(new RutasOpenStreetMap().buscarCoordenadas('Dirección desconocida'), /No se encontró/);
    });

    test('pide a OSRM longitud y latitud y convierte metros y segundos', async (t) => {
        const http = t.mock.method(globalThis, 'fetch', async () =>
            Response.json({ code: 'Ok', routes: [{ distance: 12600, duration: 1440 }] }));

        const ruta = await new RutasOpenStreetMap().calcularRuta(
            { lat: 4.7546, lon: -74.0463 }, { lat: 4.8616, lon: -74.0325 },
        );

        assert.deepEqual(ruta, { distanciaKm: 12.6, minutos: 24 });
        assert.equal(http.mock.calls[0].arguments[0],
            'https://router.project-osrm.org/route/v1/driving/-74.0463,4.7546;-74.0325,4.8616?overview=false');
    });

    test('rechaza una respuesta de OSRM sin ruta', async (t) => {
        t.mock.method(globalThis, 'fetch', async () => Response.json({ code: 'NoRoute' }));

        const origen = { lat: 4.7546, lon: -74.0463 };
        const destino = { lat: 4.8616, lon: -74.0325 };
        await assert.rejects(new RutasOpenStreetMap().calcularRuta(origen, destino), /no pudo calcular/);
    });
});
