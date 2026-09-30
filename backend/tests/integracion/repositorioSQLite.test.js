// Prueba de integración: puerto IRepositorioViajes + adaptador real RepositorioSQLite.
// Usa una base de datos SQLite real en memoria (nueva en cada prueba, así no dependen entre sí).
const { describe, test, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const RepositorioSQLite = require('../../src/adaptadores/salida/persistencia/RepositorioSQLite');
const Viaje = require('../../src/dominio/Viaje');
const Reserva = require('../../src/dominio/Reserva');
const ContactoEmergencia = require('../../src/dominio/ContactoEmergencia');
const Usuario = require('../../src/dominio/Usuario');
const CodigoVerificacion = require('../../src/dominio/CodigoVerificacion');
const Vehiculo = require('../../src/dominio/Vehiculo');

describe('Integracion - RepositorioSQLite', () => {
    let repo;

    beforeEach(async () => {
        repo = await RepositorioSQLite.crear(); // sin archivo: SQLite en memoria
    });

    test('guarda un viaje, le asigna id y lo recupera igual', () => {
        const viaje = repo.guardarViaje(new Viaje(null, 'c1', 'Chía', 'Universidad', '2026-10-05', '07:00', 3));

        const leido = repo.buscarViajePorId(viaje.id);

        assert.ok(viaje.id > 0);
        assert.strictEqual(leido.puntoInicio, 'Chía');
        assert.strictEqual(leido.cuposDisponibles, 3);
        assert.ok(leido instanceof Viaje);
    });

    test('actualizar un viaje guarda los cupos y el estado nuevos', () => {
        const viaje = repo.guardarViaje(new Viaje(null, 'c1', 'A', 'B', '2026-10-05', '07:00', 1));
        viaje.reservarCupo();

        repo.actualizarViaje(viaje);

        const leido = repo.buscarViajePorId(viaje.id);
        assert.strictEqual(leido.cuposDisponibles, 0);
        assert.strictEqual(leido.estado, 'lleno');
    });

    test('la búsqueda filtra por fecha, origen y destino y solo trae disponibles', () => {
        repo.guardarViaje(new Viaje(null, 'c1', 'Chía', 'Universidad', '2026-10-05', '07:00', 3));
        repo.guardarViaje(new Viaje(null, 'c2', 'Chía', 'Universidad', '2026-10-06', '07:00', 3));
        repo.guardarViaje(new Viaje(null, 'c3', 'Cajicá', 'Universidad', '2026-10-05', '08:00', 3));
        repo.guardarViaje(new Viaje(null, 'c4', 'Chía', 'Universidad', '2026-10-05', '09:00', 3, 'cancelado'));

        const resultado = repo.buscarViajes({ fecha: '2026-10-05', origen: 'Chí', destino: 'Univ' });

        assert.strictEqual(resultado.length, 1);
        assert.strictEqual(resultado[0].conductorId, 'c1');
    });

    test('la búsqueda sin filtros devuelve los viajes ordenados por fecha y hora', () => {
        repo.guardarViaje(new Viaje(null, 'c1', 'A', 'B', '2026-10-06', '07:00', 3));
        repo.guardarViaje(new Viaje(null, 'c2', 'A', 'B', '2026-10-05', '09:00', 3));
        repo.guardarViaje(new Viaje(null, 'c3', 'A', 'B', '2026-10-05', '07:00', 3));

        const resultado = repo.buscarViajes();

        assert.deepStrictEqual(resultado.map(v => v.conductorId), ['c3', 'c2', 'c1']);
    });

    test('guarda una reserva y la encuentra por código y por pasajero', () => {
        const reserva = repo.guardarReserva(new Reserva(null, 1, 'p1', 'codigo-abc', 5000));

        assert.strictEqual(repo.buscarReservaPorCodigo('codigo-abc').id, reserva.id);
        assert.strictEqual(repo.buscarReserva(1, 'p1').codigo, 'codigo-abc');
        assert.strictEqual(repo.buscarReservaPorCodigo('no-existe'), null);
    });

    test('actualizar una reserva guarda que ya fue usada', () => {
        const reserva = repo.guardarReserva(new Reserva(null, 1, 'p1', 'codigo-abc', 5000));
        reserva.marcarAbordaje(0);

        repo.actualizarReserva(reserva);

        assert.strictEqual(repo.buscarReservaPorCodigo('codigo-abc').usada, true);
    });

    test('guardar un contacto dos veces reemplaza el anterior', () => {
        repo.guardarContacto(new ContactoEmergencia('u1', 'Mamá', '3001234567'));
        repo.guardarContacto(new ContactoEmergencia('u1', 'Papá', '3109876543'));

        assert.strictEqual(repo.buscarContacto('u1').nombre, 'Papá');
        assert.strictEqual(repo.buscarContacto('u2'), null);
    });

    test('trae los viajes de un conductor y las reservas de un pasajero', () => {
        repo.guardarViaje(new Viaje(null, 'carlos@unisabana.edu.co', 'A', 'B', '2026-10-05', '07:00', 3));
        repo.guardarViaje(new Viaje(null, 'otro@unisabana.edu.co', 'A', 'B', '2026-10-05', '08:00', 3));
        repo.guardarReserva(new Reserva(null, 1, 'ana@unisabana.edu.co', 'c1', 5000));
        repo.guardarReserva(new Reserva(null, 2, 'ana@unisabana.edu.co', 'c2', 5000));

        assert.strictEqual(repo.buscarViajesDeConductor('carlos@unisabana.edu.co').length, 1);
        assert.strictEqual(repo.buscarReservasDePasajero('ana@unisabana.edu.co').length, 2);
    });

    test('guarda una solicitud pendiente y luego su aceptación, y la busca por id y por viaje', () => {
        const reserva = repo.guardarReserva(Reserva.solicitar(7, 'ana@unisabana.edu.co', 'Portal Norte'));
        reserva.aceptar('codigo-xyz', 9000);
        repo.actualizarReserva(reserva);

        const leida = repo.buscarReservaPorId(reserva.id);
        assert.strictEqual(leida.estado, 'aceptada');
        assert.strictEqual(leida.codigo, 'codigo-xyz');
        assert.strictEqual(leida.puntoRecogida, 'Portal Norte');
        assert.strictEqual(repo.buscarReservasDeViaje(7).length, 1);
    });

    test('guarda la descripción de por dónde pasa el viaje', () => {
        const viaje = repo.guardarViaje(new Viaje(null, 'c1', 'A', 'B', '2026-10-05', '07:00', 3, 'disponible', 'Autopista Norte'));
        assert.strictEqual(repo.buscarViajePorId(viaje.id).descripcionRuta, 'Autopista Norte');
    });

    test('guarda un usuario y lo actualiza cuando se verifica', () => {
        const usuario = new Usuario('ana@unisabana.edu.co', 'Ana', 'pasajero');
        repo.guardarUsuario(usuario);
        usuario.verificado = true;
        repo.guardarUsuario(usuario);

        const leido = repo.buscarUsuario('ana@unisabana.edu.co');
        assert.strictEqual(leido.verificado, true);
        assert.ok(leido instanceof Usuario);
        assert.strictEqual(repo.buscarUsuario('nadie@unisabana.edu.co'), null);
    });

    test('guarda, reemplaza y borra el código de verificación', () => {
        repo.guardarCodigoVerificacion(new CodigoVerificacion('ana@unisabana.edu.co', '111111', 5000));
        repo.guardarCodigoVerificacion(new CodigoVerificacion('ana@unisabana.edu.co', '222222', 5000));

        assert.strictEqual(repo.buscarCodigoVerificacion('ana@unisabana.edu.co').codigo, '222222');
        repo.borrarCodigoVerificacion('ana@unisabana.edu.co');
        assert.strictEqual(repo.buscarCodigoVerificacion('ana@unisabana.edu.co'), null);
    });

    test('guarda el vehículo del conductor y lo reemplaza si lo cambia', () => {
        repo.guardarVehiculo(new Vehiculo('c1', 'ABC123', 'Spark gris'));
        repo.guardarVehiculo(new Vehiculo('c1', 'XYZ987', 'Mazda 3 azul'));

        const leido = repo.buscarVehiculo('c1');
        assert.ok(leido instanceof Vehiculo);
        assert.strictEqual(leido.placa, 'XYZ987');
        assert.strictEqual(leido.descripcion, 'Mazda 3 azul');
        assert.strictEqual(repo.buscarVehiculo('nadie'), null);
    });

    test('con archivo, los viajes siguen ahí después de reiniciar (Reto 3: no se pierden)', async () => {
        const archivo = path.join(os.tmpdir(), `wheels-prueba-${Date.now()}.db`);
        const repoConArchivo = await RepositorioSQLite.crear(archivo);
        const viaje = repoConArchivo.guardarViaje(new Viaje(null, 'c1', 'Chía', 'Universidad', '2026-10-05', '07:00', 3));

        const repoReiniciado = await RepositorioSQLite.crear(archivo); // simula reiniciar el servidor

        assert.strictEqual(repoReiniciado.buscarViajePorId(viaje.id).puntoInicio, 'Chía');
        fs.unlinkSync(archivo);
    });
});
