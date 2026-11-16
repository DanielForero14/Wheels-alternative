// Pruebas de integración de caja negra: se levanta la API real (Express + SQLite en memoria
// + QR real) y se usa solo por HTTP, como lo hace la app móvil.
// Cada prueba arma su propia aplicación, así no comparten datos.
// Desde el Corte 3 cada petición lleva el token de sesión del usuario que actúa (pedir(..., como)).
const { describe, test, afterEach } = require('node:test');
const assert = require('node:assert');
const armarApp = require('../../src/configuracion');
const RutasEstimadas = require('../../src/adaptadores/salida/rutas/RutasEstimadas');

const CONDUCTOR = 'carlos@unisabana.edu.co';
const PASAJERA = 'ana@unisabana.edu.co';
const OTRO_CONDUCTOR = 'otro@unisabana.edu.co';

// El "correo" es simulado: se imprime en consola. Aquí se capturan esos mensajes
// para leer el código de verificación, como lo haría el estudiante en su bandeja.
let mensajesDeConsola = [];
const logOriginal = console.log;
console.log = (texto) => { mensajesDeConsola.push(String(texto)); };

let servidor;
// Token de sesión de cada usuario que ingresó en la prueba actual.
let tokens = {};

// En las pruebas no se usa internet: el servicio de rutas principal es el cálculo estimado,
// salvo que la prueba diga otra cosa.
async function iniciarApi(opciones = {}) {
    mensajesDeConsola = [];
    tokens = {};
    const app = await armarApp({ rutasPrincipal: new RutasEstimadas(), ...opciones });
    servidor = app.listen(0); // puerto libre al azar
    await new Promise(resolve => servidor.on('listening', resolve));
    return `http://localhost:${servidor.address().port}`;
}

// "como" es el correo del usuario que hace la petición: se envía su token, como lo hace la app.
// Sin "como" la petición va sin sesión.
async function pedir(url, metodo = 'GET', cuerpo, como) {
    const headers = { 'Content-Type': 'application/json' };
    if (como) {
        headers.Authorization = `Bearer ${tokens[como]}`;
    }
    const respuesta = await fetch(url, {
        method: metodo,
        headers,
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    return { status: respuesta.status, datos: await respuesta.json() };
}

function codigoEnviadoA(correo) {
    const correoRecibido = mensajesDeConsola.filter(m => m.includes(`[EMAIL a ${correo}]`)).pop();
    return correoRecibido.match(/(\d{6})/)[1];
}

// Ingreso completo: pedir código -> leerlo del correo -> verificarlo y guardar el token.
async function ingresar(api, correo, rol) {
    await pedir(`${api}/auth/solicitar-codigo`, 'POST', { nombre: 'Estudiante', correo, rol });
    const verificacion = await pedir(`${api}/auth/verificar`, 'POST', { correo, codigo: codigoEnviadoA(correo) });
    tokens[correo] = verificacion.datos.token;
    return verificacion;
}

// Fecha de mañana para que el viaje siempre sea futuro.
function manana() {
    const fecha = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return fecha.toISOString().slice(0, 10);
}

const nuevoViaje = (cambios = {}) => ({
    puntoInicio: 'Chía', puntoFinal: 'Universidad',
    fecha: manana(), hora: '07:00', cuposDisponibles: 2, ...cambios,
});

// Deja listos un conductor (con su vehículo) y una pasajera verificados, y un viaje programado.
async function escenarioBasico(opciones) {
    const api = await iniciarApi(opciones);
    await ingresar(api, CONDUCTOR, 'conductor');
    await pedir(`${api}/usuarios/${CONDUCTOR}/vehiculo`, 'PUT', { placa: 'abc123', descripcion: 'Chevrolet Spark gris' }, CONDUCTOR);
    await ingresar(api, PASAJERA, 'pasajero');
    const viaje = (await pedir(`${api}/viajes`, 'POST', nuevoViaje(), CONDUCTOR)).datos;
    return { api, viaje };
}

afterEach(() => {
    if (servidor) servidor.close();
});

describe('Integracion - API (flujos de sistema de extremo a extremo)', () => {
    test('Ingreso: correo institucional + código enviado al correo; se entrega un token de sesión', async () => {
        const api = await iniciarApi();

        const solicitud = await pedir(`${api}/auth/solicitar-codigo`, 'POST', { nombre: 'Ana', correo: PASAJERA, rol: 'pasajero' });
        const verificacion = await pedir(`${api}/auth/verificar`, 'POST', { correo: PASAJERA, codigo: codigoEnviadoA(PASAJERA) });

        assert.strictEqual(solicitud.status, 200);
        assert.strictEqual(verificacion.status, 200);
        assert.strictEqual(verificacion.datos.verificado, true);
        assert.strictEqual(verificacion.datos.rol, 'pasajero');
        assert.match(verificacion.datos.token, /^[\w-]+\.[\w-]+$/);
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

    test('Salud: /salud responde sin sesión con el estado y la versión', async () => {
        const api = await iniciarApi({ version: '3.0.0' });
        const respuesta = await pedir(`${api}/salud`);
        assert.strictEqual(respuesta.status, 200);
        assert.deepStrictEqual(respuesta.datos, { estado: 'ok', version: '3.0.0' });
    });

    test('Reto 3: programar un viaje y encontrarlo en la búsqueda', async () => {
        const { api, viaje } = await escenarioBasico();

        const busqueda = await pedir(`${api}/viajes?fecha=${manana()}&origen=Chía`, 'GET', undefined, PASAJERA);
        const delConductor = await pedir(`${api}/usuarios/${CONDUCTOR}/viajes`, 'GET', undefined, CONDUCTOR);

        assert.strictEqual(busqueda.datos.length, 1);
        assert.strictEqual(busqueda.datos[0].id, viaje.id);
        assert.strictEqual(busqueda.datos[0].conductorId, CONDUCTOR);
        assert.strictEqual(delConductor.datos.length, 1);
    });

    test('Reto 3: tiempo estimado desde mi ubicación hasta el destino del viaje', async () => {
        const { api, viaje } = await escenarioBasico();
        const url = `${api}/viajes/${viaje.id}/tiempo-estimado?lat=4.7546&lon=-74.0463`;

        const primera = await pedir(url, 'GET', undefined, PASAJERA);
        const segunda = await pedir(url, 'GET', undefined, PASAJERA);

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

        const respuesta = await pedir(`${api}/viajes/${viaje.id}/tiempo-estimado?lat=4.7546&lon=-74.0463`, 'GET', undefined, PASAJERA);

        assert.strictEqual(respuesta.status, 200);
        assert.strictEqual(respuesta.datos.fuente, 'RutasEstimadas');
    });

    test('Reto 3: una ubicación inválida se rechaza con 400', async () => {
        const { api, viaje } = await escenarioBasico();
        const respuesta = await pedir(`${api}/viajes/${viaje.id}/tiempo-estimado?lat=abc&lon=-74`, 'GET', undefined, PASAJERA);
        assert.strictEqual(respuesta.status, 400);
    });

    test('Reto 1: el conductor registra su vehículo; sin vehículo no puede programar viajes', async () => {
        const api = await iniciarApi();
        await ingresar(api, CONDUCTOR, 'conductor');

        const sinVehiculo = await pedir(`${api}/viajes`, 'POST', nuevoViaje(), CONDUCTOR);
        const consultaVacia = await pedir(`${api}/usuarios/${CONDUCTOR}/vehiculo`, 'GET', undefined, CONDUCTOR);
        const placaMala = await pedir(`${api}/usuarios/${CONDUCTOR}/vehiculo`, 'PUT', { placa: 'AB12', descripcion: 'Spark gris' }, CONDUCTOR);
        const registro = await pedir(`${api}/usuarios/${CONDUCTOR}/vehiculo`, 'PUT', { placa: 'abc 123', descripcion: 'Spark gris' }, CONDUCTOR);
        const conVehiculo = await pedir(`${api}/viajes`, 'POST', nuevoViaje(), CONDUCTOR);

        assert.strictEqual(sinVehiculo.status, 400);
        assert.match(sinVehiculo.datos.error, /vehículo/);
        assert.strictEqual(consultaVacia.status, 404);
        assert.strictEqual(placaMala.status, 400);
        assert.strictEqual(registro.datos.placa, 'ABC123');
        assert.strictEqual(conVehiculo.status, 201);
    });

    test('Reto 1: el pasajero ve el nombre del conductor, y la placa solo cuando lo aceptan', async () => {
        const { api, viaje } = await escenarioBasico();

        const busqueda = await pedir(`${api}/viajes`, 'GET', undefined, PASAJERA);
        const solicitud = await pedir(`${api}/viajes/${viaje.id}/reservar`, 'POST', { puntoRecogida: 'Portal Norte' }, PASAJERA);
        const antes = (await pedir(`${api}/usuarios/${PASAJERA}/reservas`, 'GET', undefined, PASAJERA)).datos[0];
        await pedir(`${api}/reservas/${solicitud.datos.reserva.id}/aceptar`, 'POST', {}, CONDUCTOR);
        const despues = (await pedir(`${api}/usuarios/${PASAJERA}/reservas`, 'GET', undefined, PASAJERA)).datos[0];

        assert.strictEqual(busqueda.datos[0].conductorNombre, 'Estudiante');
        assert.strictEqual(busqueda.datos[0].placa, undefined);
        assert.strictEqual(antes.vehiculo, null);
        assert.deepStrictEqual(despues.vehiculo, { conductorId: CONDUCTOR, placa: 'ABC123', descripcion: 'Chevrolet Spark gris' });
    });

    test('Reto 3: un viaje con fecha pasada se rechaza con 400', async () => {
        const { api } = await escenarioBasico();
        const respuesta = await pedir(`${api}/viajes`, 'POST', nuevoViaje({ fecha: '2020-01-01' }), CONDUCTOR);
        assert.strictEqual(respuesta.status, 400);
        assert.match(respuesta.datos.error, /fecha pasada/);
    });

    test('Reto 1: solicitar cupo, el conductor acepta, ver el QR, abordar y rechazar el mismo QR', async () => {
        const { api, viaje } = await escenarioBasico();

        const solicitud = await pedir(`${api}/viajes/${viaje.id}/reservar`, 'POST', { puntoRecogida: 'Portal Norte, salida oriental' }, PASAJERA);
        const pendientes = await pedir(`${api}/usuarios/${CONDUCTOR}/solicitudes`, 'GET', undefined, CONDUCTOR);
        const aceptada = await pedir(`${api}/reservas/${solicitud.datos.reserva.id}/aceptar`, 'POST', {}, CONDUCTOR);
        const misReservas = await pedir(`${api}/usuarios/${PASAJERA}/reservas`, 'GET', undefined, PASAJERA);
        const codigo = aceptada.datos.reserva.codigo;
        const primerAbordaje = await pedir(`${api}/viajes/${viaje.id}/abordar`, 'POST', { codigo }, CONDUCTOR);
        const segundoAbordaje = await pedir(`${api}/viajes/${viaje.id}/abordar`, 'POST', { codigo }, CONDUCTOR);

        assert.strictEqual(solicitud.status, 201);
        assert.strictEqual(solicitud.datos.reserva.estado, 'pendiente');
        assert.strictEqual(solicitud.datos.reserva.pasajeroId, PASAJERA);
        assert.strictEqual(pendientes.datos[0].reserva.puntoRecogida, 'Portal Norte, salida oriental');
        assert.strictEqual(aceptada.status, 200);
        assert.match(aceptada.datos.imagenQR, /^data:image\/png;base64,/);
        assert.strictEqual(misReservas.datos[0].reserva.estado, 'aceptada');
        assert.strictEqual(primerAbordaje.status, 200);
        assert.strictEqual(primerAbordaje.datos.mensaje, 'Abordaje confirmado');
        assert.strictEqual(segundoAbordaje.status, 400);
        assert.match(segundoAbordaje.datos.error, /ya fue usado/);
    });

    test('Reto 1: una solicitud rechazada no tiene QR y otro conductor no puede responderla (403)', async () => {
        const { api, viaje } = await escenarioBasico();
        await ingresar(api, OTRO_CONDUCTOR, 'conductor');
        const solicitud = await pedir(`${api}/viajes/${viaje.id}/reservar`, 'POST', { puntoRecogida: 'Portal Norte' }, PASAJERA);

        const deOtro = await pedir(`${api}/reservas/${solicitud.datos.reserva.id}/aceptar`, 'POST', {}, OTRO_CONDUCTOR);
        const rechazo = await pedir(`${api}/reservas/${solicitud.datos.reserva.id}/rechazar`, 'POST', {}, CONDUCTOR);
        const misReservas = await pedir(`${api}/usuarios/${PASAJERA}/reservas`, 'GET', undefined, PASAJERA);

        assert.strictEqual(deOtro.status, 403);
        assert.strictEqual(rechazo.datos.reserva.estado, 'rechazada');
        assert.strictEqual(misReservas.datos[0].imagenQR, null);
    });

    test('el conductor puede describir por dónde pasa y el pasajero lo ve en la búsqueda', async () => {
        const { api } = await escenarioBasico();
        await pedir(`${api}/viajes`, 'POST', nuevoViaje({ puntoInicio: 'Cota', descripcionRuta: 'Autopista Norte hasta la 134, luego la Séptima' }), CONDUCTOR);

        const busqueda = await pedir(`${api}/viajes?origen=Cota`, 'GET', undefined, PASAJERA);

        assert.strictEqual(busqueda.datos[0].descripcionRuta, 'Autopista Norte hasta la 134, luego la Séptima');
    });

    test('Reto 1: un código inventado no permite abordar', async () => {
        const { api, viaje } = await escenarioBasico();
        const respuesta = await pedir(`${api}/viajes/${viaje.id}/abordar`, 'POST', { codigo: 'inventado' }, CONDUCTOR);
        assert.strictEqual(respuesta.status, 400);
        assert.match(respuesta.datos.error, /Código inválido/);
    });

    test('cuando se acaban los cupos, el viaje ya no aparece en la búsqueda', async () => {
        const { api } = await escenarioBasico();
        const viaje = (await pedir(`${api}/viajes`, 'POST', nuevoViaje({ cuposDisponibles: 1 }), CONDUCTOR)).datos;

        const solicitud = await pedir(`${api}/viajes/${viaje.id}/reservar`, 'POST', { puntoRecogida: 'Portal Norte' }, PASAJERA);
        await pedir(`${api}/reservas/${solicitud.datos.reserva.id}/aceptar`, 'POST', {}, CONDUCTOR);
        await ingresar(api, 'luis@unisabana.edu.co', 'pasajero');
        const otraSolicitud = await pedir(`${api}/viajes/${viaje.id}/reservar`, 'POST', { puntoRecogida: 'Portal Norte' }, 'luis@unisabana.edu.co');
        const busqueda = await pedir(`${api}/viajes`, 'GET', undefined, PASAJERA);

        assert.strictEqual(otraSolicitud.status, 400);
        assert.ok(!busqueda.datos.some(v => v.id === viaje.id));
    });

    test('Reto 2: registrar contacto, consultarlo y enviar la alerta por SMS', async () => {
        const { api, viaje } = await escenarioBasico();

        const contacto = await pedir(`${api}/usuarios/${PASAJERA}/contacto-emergencia`, 'PUT', { nombre: 'Mamá', telefono: '3001234567' }, PASAJERA);
        const consulta = await pedir(`${api}/usuarios/${PASAJERA}/contacto-emergencia`, 'GET', undefined, PASAJERA);
        const alerta = await pedir(`${api}/emergencias`, 'POST', { viajeId: viaje.id }, PASAJERA);

        assert.strictEqual(contacto.status, 200);
        assert.strictEqual(consulta.datos.telefono, '3001234567');
        assert.strictEqual(alerta.status, 200);
        assert.deepStrictEqual(alerta.datos, { enviada: true, canal: 'EmergenciaNotificador', contacto: 'Mamá' });
    });

    test('Reto 2: la alerta lleva la ubicación del usuario', async () => {
        const { api } = await escenarioBasico();
        await pedir(`${api}/usuarios/${PASAJERA}/contacto-emergencia`, 'PUT', { nombre: 'Mamá', telefono: '3001234567' }, PASAJERA);

        const alerta = await pedir(`${api}/emergencias`, 'POST', { ubicacion: { lat: 4.86, lon: -74.03 } }, PASAJERA);

        assert.strictEqual(alerta.status, 200);
        assert.ok(mensajesDeConsola.some(m => m.includes('[SMS a Mamá') && m.includes('maps.google.com/?q=4.86,-74.03')));
    });

    test('Reto 2: el botón de pánico funciona sin viaje activo', async () => {
        const { api } = await escenarioBasico();
        await pedir(`${api}/usuarios/${PASAJERA}/contacto-emergencia`, 'PUT', { nombre: 'Mamá', telefono: '3001234567' }, PASAJERA);

        const alerta = await pedir(`${api}/emergencias`, 'POST', {}, PASAJERA);

        assert.strictEqual(alerta.status, 200);
        assert.strictEqual(alerta.datos.enviada, true);
    });

    test('Reto 2: si el SMS está caído, la alerta llega por el canal de respaldo', async () => {
        const { api, viaje } = await escenarioBasico({ simularFallaSMS: true });
        await pedir(`${api}/usuarios/${PASAJERA}/contacto-emergencia`, 'PUT', { nombre: 'Mamá', telefono: '3001234567' }, PASAJERA);

        const alerta = await pedir(`${api}/emergencias`, 'POST', { viajeId: viaje.id }, PASAJERA);

        assert.strictEqual(alerta.status, 200);
        assert.strictEqual(alerta.datos.canal, 'ConsolaNotificador');
    });

    test('Reto 2: sin contacto registrado la alerta se rechaza con 400', async () => {
        const { api, viaje } = await escenarioBasico();
        const alerta = await pedir(`${api}/emergencias`, 'POST', { viajeId: viaje.id }, PASAJERA);
        const consulta = await pedir(`${api}/usuarios/${PASAJERA}/contacto-emergencia`, 'GET', undefined, PASAJERA);
        assert.strictEqual(alerta.status, 400);
        assert.strictEqual(consulta.status, 404);
    });
});

// Amenazas del modelo STRIDE (docs/seguridad.md) verificadas por HTTP.
describe('Integracion - Seguridad: autenticación y autorización', () => {
    test('sin token, con un token alterado o con un esquema distinto a Bearer se responde 401', async () => {
        const { api } = await escenarioBasico();
        const [datos, firma] = tokens[PASAJERA].split('.');
        const datosFalsos = Buffer.from(JSON.stringify({ correo: CONDUCTOR, rol: 'conductor', exp: Date.now() + 60000 }))
            .toString('base64url');

        const sinToken = await pedir(`${api}/viajes`);
        tokens.falso = `${datosFalsos}.${firma}`;
        const alterado = await pedir(`${api}/usuarios/${CONDUCTOR}/viajes`, 'GET', undefined, 'falso');
        const otroEsquema = await fetch(`${api}/viajes`, { headers: { Authorization: `Basic ${datos}.${firma}` } });

        assert.strictEqual(sinToken.status, 401);
        assert.match(sinToken.datos.error, /Inicia sesión/);
        assert.strictEqual(alterado.status, 401);
        assert.strictEqual(otroEsquema.status, 401);
    });

    test('Suplantación: el pasajero no puede reservar a nombre de otro aunque lo envíe en el cuerpo', async () => {
        const { api, viaje } = await escenarioBasico();
        await ingresar(api, 'luis@unisabana.edu.co', 'pasajero');

        const solicitud = await pedir(`${api}/viajes/${viaje.id}/reservar`, 'POST',
            { pasajeroId: 'luis@unisabana.edu.co', puntoRecogida: 'Portal Norte' }, PASAJERA);

        assert.strictEqual(solicitud.status, 201);
        assert.strictEqual(solicitud.datos.reserva.pasajeroId, PASAJERA); // se ignora el pasajeroId del cuerpo
    });

    test('Divulgación: nadie puede leer ni cambiar los datos de otro usuario (403)', async () => {
        const { api } = await escenarioBasico();
        await pedir(`${api}/usuarios/${PASAJERA}/contacto-emergencia`, 'PUT', { nombre: 'Mamá', telefono: '3001234567' }, PASAJERA);

        const leerContacto = await pedir(`${api}/usuarios/${PASAJERA}/contacto-emergencia`, 'GET', undefined, CONDUCTOR);
        const cambiarContacto = await pedir(`${api}/usuarios/${PASAJERA}/contacto-emergencia`, 'PUT', { nombre: 'X', telefono: '3000000000' }, CONDUCTOR);
        const verReservas = await pedir(`${api}/usuarios/${PASAJERA}/reservas`, 'GET', undefined, CONDUCTOR);
        const verSolicitudes = await pedir(`${api}/usuarios/${CONDUCTOR}/solicitudes`, 'GET', undefined, PASAJERA);

        assert.strictEqual(leerContacto.status, 403);
        assert.strictEqual(cambiarContacto.status, 403);
        assert.strictEqual(verReservas.status, 403);
        assert.strictEqual(verSolicitudes.status, 403);
    });

    test('Elevación de privilegios: otro conductor no puede cancelar el viaje ni validar su QR (403)', async () => {
        const { api, viaje } = await escenarioBasico();
        await ingresar(api, OTRO_CONDUCTOR, 'conductor');
        const solicitud = await pedir(`${api}/viajes/${viaje.id}/reservar`, 'POST', { puntoRecogida: 'Portal Norte' }, PASAJERA);
        const { codigo } = (await pedir(`${api}/reservas/${solicitud.datos.reserva.id}/aceptar`, 'POST', {}, CONDUCTOR)).datos.reserva;

        const cancelarAjeno = await pedir(`${api}/viajes/${viaje.id}/cancelar`, 'POST', {}, OTRO_CONDUCTOR);
        const abordarAjeno = await pedir(`${api}/viajes/${viaje.id}/abordar`, 'POST', { codigo }, OTRO_CONDUCTOR);
        const abordarPasajera = await pedir(`${api}/viajes/${viaje.id}/abordar`, 'POST', { codigo }, PASAJERA);
        const abordarConductor = await pedir(`${api}/viajes/${viaje.id}/abordar`, 'POST', { codigo }, CONDUCTOR);
        const cancelarPropio = await pedir(`${api}/viajes/${viaje.id}/cancelar`, 'POST', {}, CONDUCTOR);

        assert.strictEqual(cancelarAjeno.status, 403);
        assert.strictEqual(abordarAjeno.status, 403);
        assert.strictEqual(abordarPasajera.status, 403);
        assert.strictEqual(abordarConductor.status, 200); // los intentos ajenos no gastaron el código
        assert.strictEqual(cancelarPropio.status, 200);
        assert.strictEqual(cancelarPropio.datos.estado, 'cancelado');
    });

    test('un pasajero no puede programar viajes aunque tenga sesión (400 por rol)', async () => {
        const { api } = await escenarioBasico();
        const respuesta = await pedir(`${api}/viajes`, 'POST', nuevoViaje(), PASAJERA);
        assert.strictEqual(respuesta.status, 400);
        assert.match(respuesta.datos.error, /solo para el rol conductor/);
    });

    test('un JSON mal formado responde 400 sin mostrar detalles internos', async () => {
        const api = await iniciarApi();
        const respuesta = await fetch(`${api}/auth/verificar`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{ "correo": ',
        });
        assert.strictEqual(respuesta.status, 400);
        assert.deepStrictEqual(await respuesta.json(), { error: 'Petición inválida' });
    });

    test('la respuesta no anuncia la tecnología del servidor', async () => {
        const api = await iniciarApi();
        const respuesta = await fetch(`${api}/salud`);
        assert.strictEqual(respuesta.headers.get('x-powered-by'), null);
        assert.strictEqual(respuesta.headers.get('x-content-type-options'), 'nosniff');
    });
});

process.on('exit', () => { console.log = logOriginal; });
