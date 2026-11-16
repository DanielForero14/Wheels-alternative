// Pruebas unitarias del Reto 3: tiempo estimado hasta el destino del viaje.
// Los servicios de rutas se reemplazan por dobles de prueba (sin internet).
const { describe, test, mock } = require('node:test');
const assert = require('node:assert');
const RepositorioMemoria = require('../../src/adaptadores/salida/persistencia/RepositorioMemoria');
const Viaje = require('../../src/dominio/Viaje');
const ServicioTiempoEstimado = require('../../src/aplicacion/ServicioTiempoEstimado');

const UBICACION = { lat: 4.7546, lon: -74.0463 };
const UNIVERSIDAD = { lat: 4.8616, lon: -74.0325 };

// Doble de prueba de IServicioRutas que siempre responde lo mismo y cuenta las llamadas.
function rutasFalsas(nombre, ruta = { distanciaKm: 14.26, minutos: 27.6 }) {
    return {
        nombre,
        buscarCoordenadas: mock.fn(async () => UNIVERSIDAD),
        calcularRuta: mock.fn(async () => ruta),
    };
}

function rutasCaidas(nombre) {
    return {
        nombre,
        buscarCoordenadas: mock.fn(async () => { throw new Error('sin internet'); }),
        calcularRuta: mock.fn(async () => { throw new Error('sin internet'); }),
    };
}

function preparar(principal, respaldo = rutasFalsas('Respaldo', { distanciaKm: 15, minutos: 30 }), opciones) {
    const repo = new RepositorioMemoria();
    const viaje = repo.guardarViaje(new Viaje(null, 'carlos@unisabana.edu.co', 'Chía', 'Universidad de La Sabana', '2026-10-05', '07:00', 3));
    return { viaje, servicio: new ServicioTiempoEstimado(repo, principal, respaldo, opciones) };
}

describe('Unitaria - ServicioTiempoEstimado (Reto 3: tiempo hasta el destino)', () => {
    test('calcula distancia y minutos redondeados con el servicio principal', async () => {
        const { viaje, servicio } = preparar(rutasFalsas('OpenStreetMap'));

        const resultado = await servicio.calcularParaViaje(viaje.id, UBICACION, 0);

        assert.deepStrictEqual(resultado, {
            viajeId: viaje.id,
            destino: 'Universidad de La Sabana',
            distanciaKm: 14.3,
            minutos: 28,
            fuente: 'OpenStreetMap',
            desdeCache: false,
        });
    });

    test('la segunda consulta igual sale del caché y no llama al servicio externo', async () => {
        const principal = rutasFalsas('OpenStreetMap');
        const { viaje, servicio } = preparar(principal);

        await servicio.calcularParaViaje(viaje.id, UBICACION, 0);
        const segunda = await servicio.calcularParaViaje(viaje.id, UBICACION, 1000);

        assert.strictEqual(segunda.desdeCache, true);
        assert.strictEqual(principal.calcularRuta.mock.callCount(), 1);
        assert.strictEqual(principal.buscarCoordenadas.mock.callCount(), 1);
    });

    test('muchas consultas iguales al mismo tiempo llaman una sola vez al servicio externo', async () => {
        const principal = rutasFalsas('OpenStreetMap');
        const { viaje, servicio } = preparar(principal);

        await Promise.all([1, 2, 3, 4, 5].map(() => servicio.calcularParaViaje(viaje.id, UBICACION, 0)));

        assert.strictEqual(principal.calcularRuta.mock.callCount(), 1);
        assert.strictEqual(principal.buscarCoordenadas.mock.callCount(), 1);
    });

    test('dos personas a menos de 100 m comparten la ruta del caché', async () => {
        const principal = rutasFalsas('OpenStreetMap');
        const { viaje, servicio } = preparar(principal);

        await servicio.calcularParaViaje(viaje.id, { lat: 4.75461, lon: -74.04631 }, 0);
        const vecino = await servicio.calcularParaViaje(viaje.id, { lat: 4.75458, lon: -74.04628 }, 0);

        assert.strictEqual(vecino.desdeCache, true);
    });

    test('pasados 5 minutos (valor límite + 1 ms) la ruta se vuelve a calcular', async () => {
        const principal = rutasFalsas('OpenStreetMap');
        const { viaje, servicio } = preparar(principal);
        const cincoMinutos = 5 * 60 * 1000;

        await servicio.calcularParaViaje(viaje.id, UBICACION, 0);
        const justoAntes = await servicio.calcularParaViaje(viaje.id, UBICACION, cincoMinutos - 1);
        const despues = await servicio.calcularParaViaje(viaje.id, UBICACION, cincoMinutos + 1);

        assert.strictEqual(justoAntes.desdeCache, true);
        assert.strictEqual(despues.desdeCache, false);
        assert.strictEqual(principal.calcularRuta.mock.callCount(), 2);
    });

    test('si el servicio principal falla, responde con el de respaldo', async () => {
        const { viaje, servicio } = preparar(rutasCaidas('OpenStreetMap'));

        const resultado = await servicio.calcularParaViaje(viaje.id, UBICACION, 0);

        assert.strictEqual(resultado.fuente, 'Respaldo');
        assert.strictEqual(resultado.minutos, 30);
    });

    test('con el caché apagado siempre consulta el servicio', async () => {
        const principal = rutasFalsas('OpenStreetMap');
        const { viaje, servicio } = preparar(principal, undefined, { usarCache: false });

        await servicio.calcularParaViaje(viaje.id, UBICACION, 0);
        await servicio.calcularParaViaje(viaje.id, UBICACION, 0);

        assert.strictEqual(principal.calcularRuta.mock.callCount(), 2);
    });

    test('un viaje muy corto muestra al menos 1 minuto', async () => {
        const { viaje, servicio } = preparar(rutasFalsas('OpenStreetMap', { distanciaKm: 0.05, minutos: 0.1 }));
        const resultado = await servicio.calcularParaViaje(viaje.id, UBICACION, 0);
        assert.strictEqual(resultado.minutos, 1);
    });

    for (const origen of [{ lat: 'abc', lon: -74 }, { lat: 91, lon: -74 }, { lat: 4.7, lon: 181 }, {}]) {
        test(`rechaza la ubicación inválida ${JSON.stringify(origen)}`, async () => {
            const { viaje, servicio } = preparar(rutasFalsas('OpenStreetMap'));
            await assert.rejects(servicio.calcularParaViaje(viaje.id, origen, 0), /ubicación de origen no es válida/);
        });
    }

    test('rechaza un viaje que no existe', async () => {
        const { servicio } = preparar(rutasFalsas('OpenStreetMap'));
        await assert.rejects(servicio.calcularParaViaje(999, UBICACION, 0), /Viaje no encontrado/);
    });
});
