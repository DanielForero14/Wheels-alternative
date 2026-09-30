// Pruebas de integración de caja negra: se levanta la API real (Express + SQLite en memoria
// + QR real) y se usa solo por HTTP, como lo hace la app móvil.
// Cada prueba arma su propia aplicación, así no comparten datos.
const { describe, test, afterEach } = require('node:test');
const assert = require('node:assert');
const armarApp = require('../../src/configuracion');
const RutasEstimadas = require('../../src/adaptadores/salida/rutas/RutasEstimadas');

const CONDUCTOR = 'carlos@unisabana.edu.co';
const PASAJERA = 'ana@unisabana.edu.co';

// El "correo" es simulado: se imprime en consola. Aquí se capturan esos mensajes
// para leer el código de verificación, como lo haría el estudiante en su bandeja.
let mensajesDeConsola = [];
const logOriginal = console.log;
console.log = (texto) => { mensajesDeConsola.push(String(texto)); };

let servidor;

// En las pruebas no se usa internet: el servicio de rutas principal es el cálculo estimado,
// salvo que la prueba diga otra cosa.
async function iniciarApi(opciones = {}) {
    mensajesDeConsola = [];
    const app = await armarApp({ rutasPrincipal: new RutasEstimadas(), ...opciones });
    servidor = app.listen(0); // puerto libre al azar
    await new Promise(resolve => servidor.on('listening', resolve));
    return `http://localhost:${servidor.address().port}`;
}

async function pedir(url, metodo = 'GET', cuerpo) {
    const respuesta = await fetch(url, {
        method: metodo,
        headers: { 'Content-Type': 'application/json' },
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    return { status: respuesta.status, datos: await respuesta.json() };
}

function codigoEnviadoA(correo) {
    const correoRecibido = mensajesDeConsola.filter(m => m.includes(`[EMAIL a ${correo}]`)).pop();
    return correoRecibido.match(/(\d{6})/)[1];
}

// Ingreso completo: pedir código -> leerlo del correo -> verificarlo.
async function ingresar(api, correo, rol) {
    await pedir(`${api}/auth/solicitar-codigo`, 'POST', { nombre: 'Estudiante', correo, rol });
    return pedir(`${api}/auth/verificar`, 'POST', { correo, codigo: codigoEnviadoA(correo) });
}

// Fecha de mañana para que el viaje siempre sea futuro.
function manana() {
    const fecha = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return fecha.toISOString().slice(0, 10);
}

const nuevoViaje = (cambios = {}) => ({
    conductorId: CONDUCTOR, puntoInicio: 'Chía', puntoFinal: 'Universidad',
    fecha: manana(), hora: '07:00', cuposDisponibles: 2, ...cambios,
});

// Deja listos un conductor y una pasajera verificados, y un viaje programado.
async function escenarioBasico(opciones) {
    const api = await iniciarApi(opciones);
    await ingresar(api, CONDUCTOR, 'conductor');
    await ingresar(api, PASAJERA, 'pasajero');
    const viaje = (await pedir(`${api}/viajes`, 'POST', nuevoViaje())).datos;
    return { api, viaje };
}

afterEach(() => {
    if (servidor) servidor.close();
});

describe('Integracion - API (flujos de sistema de extremo a extremo)', () => {
    test('Ingreso: correo institucional + código enviado al correo', async () => {
        const api = await iniciarApi();

        const solicitud = await pedir(`${api}/auth/solicitar-codigo`, 'POST', { nombre: 'Ana', correo: PASAJERA, rol: 'pasajero' });
        const verificacion = await pedir(`${api}/auth/verificar`, 'POST', { correo: PASAJERA, codigo: codigoEnviadoA(PASAJERA) });

        assert.strictEqual(solicitud.status, 200);
        assert.strictEqual(verificacion.status, 200);
        assert.strictEqual(verificacion.datos.verificado, true);
        assert.strictEqual(verificacion.datos.rol, 'pasajero');
    });

    test('Ingreso: un correo que no es de La Sabana se rechaza con 400', async () => {
        const api = await iniciarApi();
        const respuesta = await pedir(`${api}/auth/solicitar-codigo`, 'POST', { nombre: 'Ana', correo: 'ana@gmail.com', rol: 'pasajero' });
        assert.strictEqual(respuesta.status, 400);
        assert.match(respuesta.datos.error, /@unisabana.edu.co/);
    });

    test('Ingreso: un código incorrecto se rechaza con 400', async () => {
        const api = await iniciarApi();
        await pedir(`${api}/auth/solicitar-codigo`, 'POST', { nombre: 'Ana', correo: PASAJERA, rol: 'pasajero' });
        const respuesta = await pedir(`${api}/auth/verificar`, 'POST', { correo: PASAJERA, codigo: 'xxxxxx' });
        assert.strictEqual(respuesta.status, 400);
    });

    test('Reto 3: programar un viaje y encontrarlo en la búsqueda', async () => {
        const { api, viaje } = await escenarioBasico();

        const busqueda = await pedir(`${api}/viajes?fecha=${manana()}&origen=Chía`);
        const delConductor = await pedir(`${api}/usuarios/${CONDUCTOR}/viajes`);

        assert.strictEqual(busqueda.datos.length, 1);
        assert.strictEqual(busqueda.datos[0].id, viaje.id);
        assert.strictEqual(delConductor.datos.length, 1);
    });

    test('Reto 3: tiempo estimado desde mi ubicación hasta el destino del viaje', async () => {
        const { api, viaje } = await escenarioBasico();
        const url = `${api}/viajes/${viaje.id}/tiempo-estimado?lat=4.7546&lon=-74.0463`;

        const primera = await pedir(url);
        const segunda = await pedir(url);

        assert.strictEqual(primera.status, 200);
        assert.strictEqual(primera.datos.destino, 'Universidad');
        assert.ok(primera.datos.minutos > 0 && primera.datos.distanciaKm > 0);
        assert.strictEqual(primera.datos.desdeCache, false);
        assert.strictEqual(segunda.datos.desdeCache, true);
    });

    test('Reto 3: si el servicio de rutas externo está caído, responde el respaldo', async () => {
        const servicioCaido = {
            nombre: 'ServicioCaido',
            buscarCoordenadas: async () => { throw new Error('sin internet'); },
            calcularRuta: async () => { throw new Error('sin internet'); },
        };
        const { api, viaje } = await escenarioBasico({ rutasPrincipal: servicioCaido });

        const respuesta = await pedir(`${api}/viajes/${viaje.id}/tiempo-estimado?lat=4.7546&lon=-74.0463`);

        assert.strictEqual(respuesta.status, 200);
        assert.strictEqual(respuesta.datos.fuente, 'RutasEstimadas');
    });

    test('Reto 3: una ubicación inválida se rechaza con 400', async () => {
        const { api, viaje } = await escenarioBasico();
        const respuesta = await pedir(`${api}/viajes/${viaje.id}/tiempo-estimado?lat=abc&lon=-74`);
        assert.strictEqual(respuesta.status, 400);
    });

    test('Reto 3: sin verificar el correo no se puede programar un viaje', async () => {
        const api = await iniciarApi();
        const respuesta = await pedir(`${api}/viajes`, 'POST', nuevoViaje());
        assert.strictEqual(respuesta.status, 400);
        assert.match(respuesta.datos.error, /no ha verificado/);
    });

    test('Reto 3: un viaje con fecha pasada se rechaza con 400', async () => {
        const { api } = await escenarioBasico();
        const respuesta = await pedir(`${api}/viajes`, 'POST', nuevoViaje({ fecha: '2020-01-01' }));
        assert.strictEqual(respuesta.status, 400);
        assert.match(respuesta.datos.error, /fecha pasada/);
    });

    test('Reto 1: solicitar cupo, el conductor acepta, ver el QR, abordar y rechazar el mismo QR', async () => {
        const { api, viaje } = await escenarioBasico();

        const solicitud = await pedir(`${api}/viajes/${viaje.id}/reservar`, 'POST', { pasajeroId: PASAJERA, puntoRecogida: 'Portal Norte, salida oriental' });
        const pendientes = await pedir(`${api}/usuarios/${CONDUCTOR}/solicitudes`);
        const aceptada = await pedir(`${api}/reservas/${solicitud.datos.reserva.id}/aceptar`, 'POST', { conductorId: CONDUCTOR });
        const misReservas = await pedir(`${api}/usuarios/${PASAJERA}/reservas`);
        const codigo = aceptada.datos.reserva.codigo;
        const primerAbordaje = await pedir(`${api}/viajes/${viaje.id}/abordar`, 'POST', { codigo });
        const segundoAbordaje = await pedir(`${api}/viajes/${viaje.id}/abordar`, 'POST', { codigo });

        assert.strictEqual(solicitud.status, 201);
        assert.strictEqual(solicitud.datos.reserva.estado, 'pendiente');
        assert.strictEqual(pendientes.datos[0].reserva.puntoRecogida, 'Portal Norte, salida oriental');
        assert.strictEqual(aceptada.status, 200);
        assert.match(aceptada.datos.imagenQR, /^data:image\/png;base64,/);
        assert.strictEqual(misReservas.datos[0].reserva.estado, 'aceptada');
        assert.strictEqual(primerAbordaje.status, 200);
        assert.strictEqual(primerAbordaje.datos.mensaje, 'Abordaje confirmado');
        assert.strictEqual(segundoAbordaje.status, 400);
        assert.match(segundoAbordaje.datos.error, /ya fue usado/);
    });

    test('Reto 1: una solicitud rechazada no tiene QR y otro conductor no puede responderla', async () => {
        const { api, viaje } = await escenarioBasico();
        await ingresar(api, 'otro@unisabana.edu.co', 'conductor');
        const solicitud = await pedir(`${api}/viajes/${viaje.id}/reservar`, 'POST', { pasajeroId: PASAJERA, puntoRecogida: 'Portal Norte' });

        const deOtro = await pedir(`${api}/reservas/${solicitud.datos.reserva.id}/aceptar`, 'POST', { conductorId: 'otro@unisabana.edu.co' });
        const rechazo = await pedir(`${api}/reservas/${solicitud.datos.reserva.id}/rechazar`, 'POST', { conductorId: CONDUCTOR });
        const misReservas = await pedir(`${api}/usuarios/${PASAJERA}/reservas`);

        assert.strictEqual(deOtro.status, 400);
        assert.strictEqual(rechazo.datos.reserva.estado, 'rechazada');
        assert.strictEqual(misReservas.datos[0].imagenQR, null);
    });

    test('el conductor puede describir por dónde pasa y el pasajero lo ve en la búsqueda', async () => {
        const { api } = await escenarioBasico();
        await pedir(`${api}/viajes`, 'POST', nuevoViaje({ puntoInicio: 'Cota', descripcionRuta: 'Autopista Norte hasta la 134, luego la Séptima' }));

        const busqueda = await pedir(`${api}/viajes?origen=Cota`);

        assert.strictEqual(busqueda.datos[0].descripcionRuta, 'Autopista Norte hasta la 134, luego la Séptima');
    });

    test('Reto 1: un código inventado no permite abordar', async () => {
        const { api, viaje } = await escenarioBasico();
        const respuesta = await pedir(`${api}/viajes/${viaje.id}/abordar`, 'POST', { codigo: 'inventado' });
        assert.strictEqual(respuesta.status, 400);
        assert.match(respuesta.datos.error, /Código inválido/);
    });

    test('cuando se acaban los cupos, el viaje ya no aparece en la búsqueda', async () => {
        const { api } = await escenarioBasico();
        const viaje = (await pedir(`${api}/viajes`, 'POST', nuevoViaje({ cuposDisponibles: 1 }))).datos;

        const solicitud = await pedir(`${api}/viajes/${viaje.id}/reservar`, 'POST', { pasajeroId: PASAJERA, puntoRecogida: 'Portal Norte' });
        await pedir(`${api}/reservas/${solicitud.datos.reserva.id}/aceptar`, 'POST', { conductorId: CONDUCTOR });
        await ingresar(api, 'luis@unisabana.edu.co', 'pasajero');
        const otraSolicitud = await pedir(`${api}/viajes/${viaje.id}/reservar`, 'POST', { pasajeroId: 'luis@unisabana.edu.co', puntoRecogida: 'Portal Norte' });
        const busqueda = await pedir(`${api}/viajes`);

        assert.strictEqual(otraSolicitud.status, 400);
        assert.ok(!busqueda.datos.some(v => v.id === viaje.id));
    });

    test('Reto 2: registrar contacto, consultarlo y enviar la alerta por SMS', async () => {
        const { api, viaje } = await escenarioBasico();

        const contacto = await pedir(`${api}/usuarios/${PASAJERA}/contacto-emergencia`, 'PUT', { nombre: 'Mamá', telefono: '3001234567' });
        const consulta = await pedir(`${api}/usuarios/${PASAJERA}/contacto-emergencia`);
        const alerta = await pedir(`${api}/emergencias`, 'POST', { usuarioId: PASAJERA, viajeId: viaje.id });

        assert.strictEqual(contacto.status, 200);
        assert.strictEqual(consulta.datos.telefono, '3001234567');
        assert.strictEqual(alerta.status, 200);
        assert.deepStrictEqual(alerta.datos, { enviada: true, canal: 'EmergenciaNotificador', contacto: 'Mamá' });
    });

    test('Reto 2: la alerta lleva la ubicación del usuario', async () => {
        const { api } = await escenarioBasico();
        await pedir(`${api}/usuarios/${PASAJERA}/contacto-emergencia`, 'PUT', { nombre: 'Mamá', telefono: '3001234567' });

        const alerta = await pedir(`${api}/emergencias`, 'POST', { usuarioId: PASAJERA, ubicacion: { lat: 4.86, lon: -74.03 } });

        assert.strictEqual(alerta.status, 200);
        assert.ok(mensajesDeConsola.some(m => m.includes('[SMS a Mamá') && m.includes('maps.google.com/?q=4.86,-74.03')));
    });

    test('Reto 2: el botón de pánico funciona sin viaje activo', async () => {
        const { api } = await escenarioBasico();
        await pedir(`${api}/usuarios/${PASAJERA}/contacto-emergencia`, 'PUT', { nombre: 'Mamá', telefono: '3001234567' });

        const alerta = await pedir(`${api}/emergencias`, 'POST', { usuarioId: PASAJERA });

        assert.strictEqual(alerta.status, 200);
        assert.strictEqual(alerta.datos.enviada, true);
    });

    test('Reto 2: si el SMS está caído, la alerta llega por el canal de respaldo', async () => {
        const { api, viaje } = await escenarioBasico({ simularFallaSMS: true });
        await pedir(`${api}/usuarios/${PASAJERA}/contacto-emergencia`, 'PUT', { nombre: 'Mamá', telefono: '3001234567' });

        const alerta = await pedir(`${api}/emergencias`, 'POST', { usuarioId: PASAJERA, viajeId: viaje.id });

        assert.strictEqual(alerta.status, 200);
        assert.strictEqual(alerta.datos.canal, 'ConsolaNotificador');
    });

    test('Reto 2: sin contacto registrado la alerta se rechaza con 400', async () => {
        const { api, viaje } = await escenarioBasico();
        const alerta = await pedir(`${api}/emergencias`, 'POST', { usuarioId: 'nadie@unisabana.edu.co', viajeId: viaje.id });
        const consulta = await pedir(`${api}/usuarios/nadie@unisabana.edu.co/contacto-emergencia`);
        assert.strictEqual(alerta.status, 400);
        assert.strictEqual(consulta.status, 404);
    });
});

process.on('exit', () => { console.log = logOriginal; });
