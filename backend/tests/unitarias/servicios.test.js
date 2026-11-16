// Pruebas unitarias de los casos de uso (capa de aplicación).
// Los puertos se reemplazan por dobles de prueba:
// - RepositorioMemoria como repositorio falso (sin base de datos)
// - un generador de códigos falso (sin librería de QR ni azar)
// - notificadores espía creados con mock.fn() (sin enviar nada)
const { describe, test, mock } = require('node:test');
const assert = require('node:assert');
const RepositorioMemoria = require('../../src/adaptadores/salida/persistencia/RepositorioMemoria');
const Usuario = require('../../src/dominio/Usuario');
const Vehiculo = require('../../src/dominio/Vehiculo');
const ServicioUsuarios = require('../../src/aplicacion/ServicioUsuarios');
const ServicioViajes = require('../../src/aplicacion/ServicioViajes');
const ServicioReservas = require('../../src/aplicacion/ServicioReservas');
const ServicioEmergencia = require('../../src/aplicacion/ServicioEmergencia');

const HOY = '2026-10-01';
const CONDUCTOR = 'carlos@unisabana.edu.co';
const PASAJERA = 'ana@unisabana.edu.co';

const datosViaje = (cambios = {}) => ({
    conductorId: CONDUCTOR, puntoInicio: 'Chía', puntoFinal: 'Universidad',
    fecha: '2026-10-05', hora: '07:00', cuposDisponibles: 2, ...cambios,
});

function notificadorEspia(nombre = 'Espia') {
    return { nombre, notificar: mock.fn() };
}

function generadorFalso() {
    let n = 0;
    return {
        generarCodigo: () => `codigo-${++n}`,
        generarCodigoNumerico: () => '123456',
        generarImagenQR: async (codigo) => `qr-de-${codigo}`,
    };
}

// Repositorio con un conductor (con su vehículo) y una pasajera ya verificados.
function repoConUsuarios() {
    const repo = new RepositorioMemoria();
    repo.guardarUsuario(new Usuario(CONDUCTOR, 'Carlos', 'conductor', true));
    repo.guardarVehiculo(new Vehiculo(CONDUCTOR, 'ABC123', 'Chevrolet Spark gris'));
    repo.guardarUsuario(new Usuario(PASAJERA, 'Ana', 'pasajero', true));
    return repo;
}

function crearServicios(repo, notificadores = []) {
    const generador = generadorFalso();
    const usuarios = new ServicioUsuarios(repo, generador, notificadorEspia());
    return {
        usuarios,
        viajes: new ServicioViajes(repo, usuarios, notificadores),
        reservas: new ServicioReservas(repo, generador, usuarios, notificadores),
    };
}

describe('Unitaria - ServicioUsuarios (ingreso con correo institucional)', () => {
    test('pedir código guarda al usuario sin verificar y le envía el código por correo', () => {
        const repo = new RepositorioMemoria();
        const correo = notificadorEspia();
        const servicio = new ServicioUsuarios(repo, generadorFalso(), correo);

        servicio.solicitarCodigo('Ana', 'Ana@UniSabana.edu.co', 'pasajero', 0);

        assert.strictEqual(repo.buscarUsuario(PASAJERA).verificado, false);
        const [, mensaje, destinatario] = correo.notificar.mock.calls[0].arguments;
        assert.match(mensaje, /123456/);
        assert.strictEqual(destinatario.correo, PASAJERA);
    });

    test('un correo que no es de La Sabana no recibe código', () => {
        const correo = notificadorEspia();
        const servicio = new ServicioUsuarios(new RepositorioMemoria(), generadorFalso(), correo);

        assert.throws(() => servicio.solicitarCodigo('Ana', 'ana@gmail.com', 'pasajero', 0), /@unisabana.edu.co/);
        assert.strictEqual(correo.notificar.mock.callCount(), 0);
    });

    test('con el código correcto el usuario queda verificado', () => {
        const repo = new RepositorioMemoria();
        const servicio = new ServicioUsuarios(repo, generadorFalso(), notificadorEspia());
        servicio.solicitarCodigo('Ana', PASAJERA, 'pasajero', 0);

        const usuario = servicio.verificarCodigo(PASAJERA, '123456', 1000);

        assert.strictEqual(usuario.verificado, true);
        assert.strictEqual(repo.buscarUsuario(PASAJERA).verificado, true);
    });

    test('con un código incorrecto no se verifica', () => {
        const servicio = new ServicioUsuarios(new RepositorioMemoria(), generadorFalso(), notificadorEspia());
        servicio.solicitarCodigo('Ana', PASAJERA, 'pasajero', 0);

        assert.throws(() => servicio.verificarCodigo(PASAJERA, '000000', 1000), /no es correcto/);
    });

    test('un código ya usado no sirve otra vez', () => {
        const servicio = new ServicioUsuarios(new RepositorioMemoria(), generadorFalso(), notificadorEspia());
        servicio.solicitarCodigo('Ana', PASAJERA, 'pasajero', 0);
        servicio.verificarCodigo(PASAJERA, '123456', 1000);

        assert.throws(() => servicio.verificarCodigo(PASAJERA, '123456', 2000), /Primero pide un código/);
    });

    test('un código vencido (después de 10 minutos) no sirve', () => {
        const servicio = new ServicioUsuarios(new RepositorioMemoria(), generadorFalso(), notificadorEspia());
        servicio.solicitarCodigo('Ana', PASAJERA, 'pasajero', 0);
        const onceMinutos = 11 * 60 * 1000;

        assert.throws(() => servicio.verificarCodigo(PASAJERA, '123456', onceMinutos), /venció/);
    });

    test('exigirUsuarioVerificado rechaza usuarios sin verificar o con otro rol', () => {
        const repo = repoConUsuarios();
        repo.guardarUsuario(new Usuario('nuevo@unisabana.edu.co', 'Nuevo', 'pasajero', false));
        const servicio = new ServicioUsuarios(repo, generadorFalso(), notificadorEspia());

        assert.throws(() => servicio.exigirUsuarioVerificado('nuevo@unisabana.edu.co'), /no ha verificado/);
        assert.throws(() => servicio.exigirUsuarioVerificado('nadie@unisabana.edu.co'), /no ha verificado/);
        assert.throws(() => servicio.exigirUsuarioVerificado(PASAJERA, 'conductor'), /solo para el rol conductor/);
        assert.strictEqual(servicio.exigirUsuarioVerificado(CONDUCTOR, 'conductor').nombre, 'Carlos');
    });
});

describe('Unitaria - ServicioViajes', () => {
    test('programar un viaje lo guarda en el repositorio con un id', () => {
        const repo = repoConUsuarios();
        const { viajes } = crearServicios(repo);

        const viaje = viajes.programarViaje(datosViaje(), HOY);

        assert.ok(viaje.id);
        assert.strictEqual(repo.buscarViajePorId(viaje.id), viaje);
    });

    test('sin vehículo registrado no se puede programar un viaje', () => {
        const repo = repoConUsuarios();
        repo.guardarUsuario(new Usuario('pedro@unisabana.edu.co', 'Pedro', 'conductor', true));
        const { viajes } = crearServicios(repo);

        assert.throws(() => viajes.programarViaje(datosViaje({ conductorId: 'pedro@unisabana.edu.co' }), HOY), /registra la información de tu vehículo/);
    });

    test('el conductor registra su vehículo y lo puede cambiar', () => {
        const repo = repoConUsuarios();
        const { viajes } = crearServicios(repo);

        viajes.registrarVehiculo(CONDUCTOR, 'xyz987', 'Mazda 3 azul');

        const vehiculo = viajes.vehiculoDelConductor(CONDUCTOR);
        assert.strictEqual(vehiculo.placa, 'XYZ987');
        assert.strictEqual(vehiculo.descripcion, 'Mazda 3 azul');
    });

    test('un pasajero no puede registrar vehículo', () => {
        const { viajes } = crearServicios(repoConUsuarios());
        assert.throws(() => viajes.registrarVehiculo(PASAJERA, 'ABC123', 'Spark gris'), /solo para el rol conductor/);
    });

    test('la búsqueda muestra el nombre del conductor pero no la placa', () => {
        const { viajes } = crearServicios(repoConUsuarios());
        viajes.programarViaje(datosViaje(), HOY);

        const [viaje] = viajes.buscarViajes();

        assert.strictEqual(viaje.conductorNombre, 'Carlos');
        assert.strictEqual(viaje.placa, undefined);
    });

    test('un pasajero no puede programar viajes', () => {
        const { viajes } = crearServicios(repoConUsuarios());
        assert.throws(() => viajes.programarViaje(datosViaje({ conductorId: PASAJERA }), HOY), /solo para el rol conductor/);
    });

    test('buscar filtra por fecha, origen y destino', () => {
        const { viajes } = crearServicios(repoConUsuarios());
        viajes.programarViaje(datosViaje(), HOY);
        viajes.programarViaje(datosViaje({ fecha: '2026-10-06' }), HOY);
        viajes.programarViaje(datosViaje({ puntoInicio: 'Cajicá' }), HOY);

        const resultado = viajes.buscarViajes({ fecha: '2026-10-05', origen: 'chía' });

        assert.strictEqual(resultado.length, 1);
        assert.strictEqual(resultado[0].puntoInicio, 'Chía');
    });

    test('el conductor ve sus propios viajes', () => {
        const { viajes } = crearServicios(repoConUsuarios());
        viajes.programarViaje(datosViaje(), HOY);
        viajes.programarViaje(datosViaje({ hora: '18:00' }), HOY);

        assert.strictEqual(viajes.viajesDelConductor(CONDUCTOR).length, 2);
        assert.strictEqual(viajes.viajesDelConductor(PASAJERA).length, 0);
    });

    test('cancelar un viaje cambia su estado y avisa a los notificadores', () => {
        const espia = notificadorEspia();
        const { viajes } = crearServicios(repoConUsuarios(), [espia]);
        const viaje = viajes.programarViaje(datosViaje(), HOY);

        viajes.cancelarViaje(viaje.id);

        assert.strictEqual(viaje.estado, 'cancelado');
        assert.strictEqual(espia.notificar.mock.callCount(), 1);
        assert.strictEqual(viajes.buscarViajes().length, 0);
    });

    test('cancelar un viaje que no existe lanza error', () => {
        const { viajes } = crearServicios(repoConUsuarios());
        assert.throws(() => viajes.cancelarViaje(99), /Viaje no encontrado/);
    });
});

describe('Unitaria - ServicioReservas (solicitud, aceptación y QR)', () => {
    const PUNTO = 'Portería principal del C.C. Andino';

    function preparar(cupos = 2) {
        const repo = repoConUsuarios();
        repo.guardarUsuario(new Usuario('luis@unisabana.edu.co', 'Luis', 'pasajero', true));
        const espia = notificadorEspia();
        const servicios = crearServicios(repo, [espia]);
        const viaje = servicios.viajes.programarViaje(datosViaje({ cuposDisponibles: cupos }), HOY);
        return { repo, espia, viaje, servicio: servicios.reservas, viajes: servicios.viajes };
    }

    // Pide el cupo y el conductor lo acepta: deja una reserva lista para abordar.
    async function solicitarYAceptar(servicio, viaje, pasajero = PASAJERA) {
        const solicitud = servicio.solicitarCupo(viaje.id, pasajero, PUNTO);
        return servicio.responderSolicitud(solicitud.id, CONDUCTOR, true);
    }

    test('solicitar un cupo deja la solicitud pendiente, sin código y sin ocupar cupo', () => {
        const { viaje, servicio, espia } = preparar();

        const solicitud = servicio.solicitarCupo(viaje.id, PASAJERA, PUNTO);

        assert.strictEqual(solicitud.estado, 'pendiente');
        assert.strictEqual(solicitud.codigo, null);
        assert.strictEqual(solicitud.puntoRecogida, PUNTO);
        assert.strictEqual(viaje.cuposDisponibles, 2);
        assert.match(espia.notificar.mock.calls[0].arguments[1], /Nueva solicitud/);
    });

    test('un punto de recogida muy corto se rechaza', () => {
        const { viaje, servicio } = preparar();
        assert.throws(() => servicio.solicitarCupo(viaje.id, PASAJERA, 'aquí'), /mínimo 5 caracteres/);
    });

    test('al aceptar se ocupa el cupo y se genera el código y la imagen QR', async () => {
        const { viaje, servicio } = preparar();

        const { reserva, imagenQR } = await solicitarYAceptar(servicio, viaje);

        assert.strictEqual(reserva.estado, 'aceptada');
        assert.strictEqual(reserva.codigo, 'codigo-1');
        assert.strictEqual(imagenQR, 'qr-de-codigo-1');
        assert.strictEqual(viaje.cuposDisponibles, 1);
    });

    test('el código vence al final del día del viaje', async () => {
        const { viaje, servicio } = preparar();
        const { reserva } = await solicitarYAceptar(servicio, viaje);
        assert.strictEqual(reserva.expira, new Date('2026-10-05T23:59:59').getTime());
    });

    test('al rechazar no se ocupa cupo ni se genera QR', async () => {
        const { viaje, servicio } = preparar();
        const solicitud = servicio.solicitarCupo(viaje.id, PASAJERA, PUNTO);

        const { reserva, imagenQR } = await servicio.responderSolicitud(solicitud.id, CONDUCTOR, false);

        assert.strictEqual(reserva.estado, 'rechazada');
        assert.strictEqual(imagenQR, null);
        assert.strictEqual(viaje.cuposDisponibles, 2);
    });

    test('solo el conductor del viaje puede responder la solicitud', async () => {
        const { viaje, servicio } = preparar();
        const solicitud = servicio.solicitarCupo(viaje.id, PASAJERA, PUNTO);
        await assert.rejects(servicio.responderSolicitud(solicitud.id, 'otro@unisabana.edu.co', true), /Solo el conductor/);
    });

    test('una solicitud ya respondida no se puede responder otra vez', async () => {
        const { viaje, servicio } = preparar();
        const solicitud = servicio.solicitarCupo(viaje.id, PASAJERA, PUNTO);
        await servicio.responderSolicitud(solicitud.id, CONDUCTOR, true);
        await assert.rejects(servicio.responderSolicitud(solicitud.id, CONDUCTOR, false), /ya fue respondida/);
    });

    test('al aceptar el último cupo se envía un aviso de "lleno" y no se aceptan más', async () => {
        const { viaje, servicio, espia } = preparar(1);
        const otra = servicio.solicitarCupo(viaje.id, 'luis@unisabana.edu.co', PUNTO);
        await solicitarYAceptar(servicio, viaje);

        assert.strictEqual(viaje.estado, 'lleno');
        assert.ok(espia.notificar.mock.calls.some(c => /quedó lleno/.test(c.arguments[1])));
        await assert.rejects(servicio.responderSolicitud(otra.id, CONDUCTOR, true), /No hay cupos/);
    });

    test('no se puede enviar dos solicitudes al mismo viaje, salvo que la anterior fuera rechazada', async () => {
        const { viaje, servicio } = preparar();
        const primera = servicio.solicitarCupo(viaje.id, PASAJERA, PUNTO);
        assert.throws(() => servicio.solicitarCupo(viaje.id, PASAJERA, PUNTO), /Ya enviaste una solicitud/);

        await servicio.responderSolicitud(primera.id, CONDUCTOR, false);
        assert.doesNotThrow(() => servicio.solicitarCupo(viaje.id, PASAJERA, PUNTO));
    });

    test('no se puede solicitar cupo sin indicar el pasajero', () => {
        const { viaje, servicio } = preparar();
        assert.throws(() => servicio.solicitarCupo(viaje.id, undefined, PUNTO), /Falta el pasajero/);
    });

    test('un estudiante sin verificar no puede solicitar cupo', () => {
        const { viaje, servicio } = preparar();
        assert.throws(() => servicio.solicitarCupo(viaje.id, 'nadie@unisabana.edu.co', PUNTO), /no ha verificado/);
    });

    test('el conductor ve las solicitudes de sus viajes con el nombre del pasajero', () => {
        const { viaje, servicio } = preparar();
        servicio.solicitarCupo(viaje.id, PASAJERA, PUNTO);

        const solicitudes = servicio.solicitudesDelConductor(CONDUCTOR);

        assert.strictEqual(solicitudes.length, 1);
        assert.strictEqual(solicitudes[0].pasajero, 'Ana');
        assert.strictEqual(solicitudes[0].reserva.puntoRecogida, PUNTO);
    });

    test('mis reservas muestra el QR solo si fue aceptada', async () => {
        const { viaje, servicio, viajes } = preparar();
        const otroViaje = viajes.programarViaje(datosViaje({ hora: '18:00' }), HOY);
        await solicitarYAceptar(servicio, viaje);
        servicio.solicitarCupo(otroViaje.id, PASAJERA, PUNTO);

        const lista = await servicio.reservasDelPasajero(PASAJERA);

        const aceptada = lista.find(r => r.reserva.estado === 'aceptada');
        const pendiente = lista.find(r => r.reserva.estado === 'pendiente');
        assert.strictEqual(aceptada.imagenQR, 'qr-de-codigo-1');
        assert.strictEqual(pendiente.imagenQR, null);
    });

    test('el vehículo del conductor solo se muestra si la solicitud fue aceptada', async () => {
        const { viaje, servicio, viajes } = preparar();
        const otroViaje = viajes.programarViaje(datosViaje({ hora: '18:00' }), HOY);
        await solicitarYAceptar(servicio, viaje);
        servicio.solicitarCupo(otroViaje.id, PASAJERA, PUNTO);

        const lista = await servicio.reservasDelPasajero(PASAJERA);

        const aceptada = lista.find(r => r.reserva.estado === 'aceptada');
        const pendiente = lista.find(r => r.reserva.estado === 'pendiente');
        assert.strictEqual(aceptada.conductorNombre, 'Carlos');
        assert.strictEqual(aceptada.vehiculo.placa, 'ABC123');
        assert.strictEqual(aceptada.vehiculo.descripcion, 'Chevrolet Spark gris');
        assert.strictEqual(pendiente.conductorNombre, 'Carlos');
        assert.strictEqual(pendiente.vehiculo, null);
    });

    test('abordar con un código válido marca la reserva como usada', async () => {
        const { viaje, servicio } = preparar();
        const { reserva } = await solicitarYAceptar(servicio, viaje);

        const resultado = servicio.validarAbordaje(viaje.id, reserva.codigo, 0);

        assert.strictEqual(resultado.usada, true);
    });

    test('un código inventado se rechaza', () => {
        const { viaje, servicio } = preparar();
        assert.throws(() => servicio.validarAbordaje(viaje.id, 'codigo-falso', 0), /Código inválido/);
    });

    test('un código de otro viaje se rechaza', async () => {
        const { viaje, servicio, viajes } = preparar();
        const otroViaje = viajes.programarViaje(datosViaje(), HOY);
        const { reserva } = await solicitarYAceptar(servicio, viaje);

        assert.throws(() => servicio.validarAbordaje(otroViaje.id, reserva.codigo, 0), /no pertenece a este viaje/);
    });

    test('un código ya usado se rechaza la segunda vez', async () => {
        const { viaje, servicio } = preparar();
        const { reserva } = await solicitarYAceptar(servicio, viaje);
        servicio.validarAbordaje(viaje.id, reserva.codigo, 0);

        assert.throws(() => servicio.validarAbordaje(viaje.id, reserva.codigo, 0), /ya fue usado/);
    });

    test('un código vencido se rechaza', async () => {
        const { viaje, servicio } = preparar();
        const { reserva } = await solicitarYAceptar(servicio, viaje);
        const despuesDelViaje = reserva.expira + 1;

        assert.throws(() => servicio.validarAbordaje(viaje.id, reserva.codigo, despuesDelViaje), /vencido/);
    });
});

describe('Unitaria - ServicioEmergencia (contacto de emergencia y botón de pánico)', () => {
    function preparar(canales) {
        const repo = repoConUsuarios();
        const viaje = crearServicios(repo).viajes.programarViaje(datosViaje(), HOY);
        const servicio = new ServicioEmergencia(repo, canales);
        servicio.registrarContacto(PASAJERA, 'Mamá', '3001234567');
        return { viaje, servicio };
    }

    function canalQueFalla(nombre) {
        return { nombre, notificar: mock.fn(() => { throw new Error('caído'); }) };
    }

    test('si el primer canal funciona, la alerta sale por ahí', () => {
        const sms = notificadorEspia('SMS');
        const correo = notificadorEspia('Correo');
        const { viaje, servicio } = preparar([sms, correo]);

        const resultado = servicio.activarAlerta(PASAJERA, viaje.id);

        assert.deepStrictEqual(resultado, { enviada: true, canal: 'SMS', contacto: 'Mamá' });
        assert.strictEqual(correo.notificar.mock.callCount(), 0);
    });

    test('si el primer canal falla, la alerta sale por el de respaldo', () => {
        const sms = canalQueFalla('SMS');
        const correo = notificadorEspia('Correo');
        const { viaje, servicio } = preparar([sms, correo]);

        const resultado = servicio.activarAlerta(PASAJERA, viaje.id);

        assert.strictEqual(resultado.enviada, true);
        assert.strictEqual(resultado.canal, 'Correo');
        assert.strictEqual(sms.notificar.mock.callCount(), 1);
    });

    test('el mensaje lleva los datos del viaje y se envía al contacto', () => {
        const sms = notificadorEspia('SMS');
        const { viaje, servicio } = preparar([sms]);

        servicio.activarAlerta(PASAJERA, viaje.id);

        const [, mensaje, destinatario] = sms.notificar.mock.calls[0].arguments;
        assert.match(mensaje, /Chía -> Universidad/);
        assert.match(mensaje, /placa ABC123/);
        assert.strictEqual(destinatario.telefono, '3001234567');
    });

    test('el botón de pánico funciona aunque el usuario no esté en un viaje', () => {
        const sms = notificadorEspia('SMS');
        const { servicio } = preparar([sms]);

        const resultado = servicio.activarAlerta(PASAJERA);

        assert.strictEqual(resultado.enviada, true);
        assert.match(sms.notificar.mock.calls[0].arguments[1], /botón de pánico/);
    });

    test('si llega la ubicación, el mensaje incluye el link del mapa', () => {
        const sms = notificadorEspia('SMS');
        const { servicio } = preparar([sms]);

        servicio.activarAlerta(PASAJERA, null, { lat: 4.8616, lon: -74.0325 });

        assert.match(sms.notificar.mock.calls[0].arguments[1], /https:\/\/maps\.google\.com\/\?q=4\.8616,-74\.0325/);
    });

    test('una ubicación inválida no se agrega al mensaje, pero la alerta igual sale', () => {
        const sms = notificadorEspia('SMS');
        const { servicio } = preparar([sms]);

        const resultado = servicio.activarAlerta(PASAJERA, null, { lat: 'x', lon: null });

        assert.strictEqual(resultado.enviada, true);
        assert.doesNotMatch(sms.notificar.mock.calls[0].arguments[1], /maps/);
    });

    test('si todos los canales fallan, se informa que no se envió', () => {
        const { viaje, servicio } = preparar([canalQueFalla('SMS'), canalQueFalla('Correo')]);

        const resultado = servicio.activarAlerta(PASAJERA, viaje.id);

        assert.strictEqual(resultado.enviada, false);
    });

    test('sin contacto registrado no se puede activar la alerta', () => {
        const { viaje, servicio } = preparar([notificadorEspia()]);
        assert.throws(() => servicio.activarAlerta('otro@unisabana.edu.co', viaje.id), /no tiene contacto/);
    });

    test('registrar de nuevo el contacto reemplaza el anterior', () => {
        const sms = notificadorEspia('SMS');
        const { viaje, servicio } = preparar([sms]);
        servicio.registrarContacto(PASAJERA, 'Papá', '3109876543');

        servicio.activarAlerta(PASAJERA, viaje.id);

        assert.strictEqual(sms.notificar.mock.calls[0].arguments[2].nombre, 'Papá');
        assert.strictEqual(servicio.buscarContacto(PASAJERA).nombre, 'Papá');
    });
});
