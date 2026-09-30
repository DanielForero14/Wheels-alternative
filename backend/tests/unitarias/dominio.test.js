// Pruebas unitarias del dominio: Viaje, ViajeFactory, Reserva y ContactoEmergencia.
// No usan base de datos, red ni Express. Siguen el patrón AAA (Arrange - Act - Assert).
const { describe, test } = require('node:test');
const assert = require('node:assert');
const Viaje = require('../../src/dominio/Viaje');
const ViajeFactory = require('../../src/dominio/ViajeFactory');
const Reserva = require('../../src/dominio/Reserva');
const ContactoEmergencia = require('../../src/dominio/ContactoEmergencia');
const Usuario = require('../../src/dominio/Usuario');
const CodigoVerificacion = require('../../src/dominio/CodigoVerificacion');

const HOY = '2026-10-01';
const datosValidos = () => ({
    conductorId: 'c1', puntoInicio: 'Chía', puntoFinal: 'Universidad',
    fecha: '2026-10-05', hora: '07:00', cuposDisponibles: 3,
});

describe('Unitaria - Viaje', () => {
    test('reservar un cupo descuenta uno de los disponibles', () => {
        // Arrange
        const viaje = new Viaje(1, 'c1', 'A', 'B', HOY, '07:00', 3);
        // Act
        viaje.reservarCupo();
        // Assert
        assert.strictEqual(viaje.cuposDisponibles, 2);
        assert.strictEqual(viaje.estado, 'disponible');
    });

    test('al reservar el último cupo el viaje queda lleno (valor límite 1 -> 0)', () => {
        const viaje = new Viaje(1, 'c1', 'A', 'B', HOY, '07:00', 1);
        viaje.reservarCupo();
        assert.strictEqual(viaje.cuposDisponibles, 0);
        assert.strictEqual(viaje.estado, 'lleno');
    });

    test('no se puede reservar si no hay cupos', () => {
        const viaje = new Viaje(1, 'c1', 'A', 'B', HOY, '07:00', 0);
        assert.throws(() => viaje.reservarCupo(), /No hay cupos disponibles/);
    });

    test('no se puede reservar en un viaje cancelado', () => {
        const viaje = new Viaje(1, 'c1', 'A', 'B', HOY, '07:00', 3);
        viaje.cancelar();
        assert.throws(() => viaje.reservarCupo(), /El viaje está cancelado/);
    });
});

describe('Unitaria - ViajeFactory (planeación de viajes)', () => {
    test('crea un viaje válido programado a futuro', () => {
        const viaje = ViajeFactory.crearViaje(datosValidos(), HOY);
        assert.strictEqual(viaje.fecha, '2026-10-05');
        assert.strictEqual(viaje.cuposDisponibles, 3);
        assert.strictEqual(viaje.estado, 'disponible');
    });

    test('acepta un viaje para el mismo día (valor límite)', () => {
        const viaje = ViajeFactory.crearViaje({ ...datosValidos(), fecha: HOY }, HOY);
        assert.strictEqual(viaje.fecha, HOY);
    });

    test('rechaza un viaje en una fecha pasada (un día antes de hoy)', () => {
        assert.throws(
            () => ViajeFactory.crearViaje({ ...datosValidos(), fecha: '2026-09-30' }, HOY),
            /fecha pasada/
        );
    });

    test('rechaza datos incompletos', () => {
        assert.throws(
            () => ViajeFactory.crearViaje({ ...datosValidos(), puntoInicio: '' }, HOY),
            /Faltan datos obligatorios/
        );
    });

    test('rechaza una fecha con formato incorrecto', () => {
        assert.throws(
            () => ViajeFactory.crearViaje({ ...datosValidos(), fecha: '05/10/2026' }, HOY),
            /formato AAAA-MM-DD/
        );
    });

    test('guarda la descripción de por dónde pasa el viaje', () => {
        const viaje = ViajeFactory.crearViaje({ ...datosValidos(), descripcionRuta: '  Autopista Norte hasta la 134  ' }, HOY);
        assert.strictEqual(viaje.descripcionRuta, 'Autopista Norte hasta la 134');
    });

    test('la descripción de la ruta admite 200 caracteres pero no 201 (valor límite)', () => {
        assert.doesNotThrow(() => ViajeFactory.crearViaje({ ...datosValidos(), descripcionRuta: 'x'.repeat(200) }, HOY));
        assert.throws(() => ViajeFactory.crearViaje({ ...datosValidos(), descripcionRuta: 'x'.repeat(201) }, HOY), /200 caracteres/);
    });

    test('rechaza una hora con formato incorrecto', () => {
        assert.throws(
            () => ViajeFactory.crearViaje({ ...datosValidos(), hora: '7am' }, HOY),
            /formato HH:MM/
        );
    });

    // Clases de equivalencia y valores límite de los cupos: válidos de 1 a 6.
    for (const cupos of [1, 6]) {
        test(`acepta ${cupos} cupos (valor límite válido)`, () => {
            const viaje = ViajeFactory.crearViaje({ ...datosValidos(), cuposDisponibles: cupos }, HOY);
            assert.strictEqual(viaje.cuposDisponibles, cupos);
        });
    }
    for (const cupos of [0, 7, 2.5, 'tres']) {
        test(`rechaza ${cupos} cupos (valor inválido)`, () => {
            assert.throws(
                () => ViajeFactory.crearViaje({ ...datosValidos(), cuposDisponibles: cupos }, HOY),
                /Los cupos deben estar entre 1 y 6/
            );
        });
    }
});

describe('Unitaria - Reserva (código QR)', () => {
    const EXPIRA = 1000;

    test('el primer abordaje con un código vigente se acepta', () => {
        const reserva = new Reserva(1, 1, 'p1', 'abc', EXPIRA);
        reserva.marcarAbordaje(EXPIRA - 1);
        assert.strictEqual(reserva.usada, true);
    });

    test('se acepta justo en el momento en que vence (valor límite)', () => {
        const reserva = new Reserva(1, 1, 'p1', 'abc', EXPIRA);
        reserva.marcarAbordaje(EXPIRA);
        assert.strictEqual(reserva.usada, true);
    });

    test('se rechaza un milisegundo después de vencer', () => {
        const reserva = new Reserva(1, 1, 'p1', 'abc', EXPIRA);
        assert.throws(() => reserva.marcarAbordaje(EXPIRA + 1), /vencido/);
    });

    test('una solicitud pendiente no permite abordar', () => {
        const reserva = Reserva.solicitar(1, 'p1', 'Portería principal');
        assert.throws(() => reserva.marcarAbordaje(0), /no ha aceptado/);
    });

    test('aceptar una solicitud pendiente le asigna código y vencimiento', () => {
        const reserva = Reserva.solicitar(1, 'p1', 'Portería principal');
        reserva.aceptar('abc', EXPIRA);
        assert.strictEqual(reserva.estado, 'aceptada');
        assert.strictEqual(reserva.codigo, 'abc');
    });

    test('el punto de recogida debe tener entre 5 y 150 caracteres (valores límite)', () => {
        assert.doesNotThrow(() => Reserva.solicitar(1, 'p1', 'Calle'));
        assert.doesNotThrow(() => Reserva.solicitar(1, 'p1', 'x'.repeat(150)));
        assert.throws(() => Reserva.solicitar(1, 'p1', 'Cll '), /mínimo 5/);
        assert.throws(() => Reserva.solicitar(1, 'p1', 'x'.repeat(151)), /150 caracteres/);
    });

    test('un código no se puede usar dos veces', () => {
        const reserva = new Reserva(1, 1, 'p1', 'abc', EXPIRA);
        reserva.marcarAbordaje(0);
        assert.throws(() => reserva.marcarAbordaje(0), /ya fue usado/);
    });
});

describe('Unitaria - ContactoEmergencia', () => {
    test('crea un contacto válido', () => {
        const contacto = new ContactoEmergencia('u1', 'Mamá', '3001234567');
        assert.strictEqual(contacto.telefono, '3001234567');
    });

    test('acepta teléfonos de 7 y 15 dígitos (valores límite)', () => {
        assert.doesNotThrow(() => new ContactoEmergencia('u1', 'A', '1234567'));
        assert.doesNotThrow(() => new ContactoEmergencia('u1', 'A', '123456789012345'));
    });

    test('rechaza teléfonos de 6 o 16 dígitos, o con letras', () => {
        for (const telefono of ['123456', '1234567890123456', '300abc4567']) {
            assert.throws(() => new ContactoEmergencia('u1', 'A', telefono), /entre 7 y 15 dígitos/);
        }
    });

    test('rechaza un contacto sin nombre', () => {
        assert.throws(() => new ContactoEmergencia('u1', '', '3001234567'), /Faltan datos/);
    });
});

describe('Unitaria - Usuario (correo institucional)', () => {
    test('acepta un correo @unisabana.edu.co', () => {
        const usuario = new Usuario('ana@unisabana.edu.co', 'Ana', 'pasajero');
        assert.strictEqual(usuario.correo, 'ana@unisabana.edu.co');
        assert.strictEqual(usuario.verificado, false);
    });

    test('guarda el correo en minúsculas y sin espacios', () => {
        const usuario = new Usuario('  Ana.Perez@UNISABANA.EDU.CO ', 'Ana', 'conductor');
        assert.strictEqual(usuario.correo, 'ana.perez@unisabana.edu.co');
    });

    // Clases inválidas: otro dominio, sin arroba, sin usuario y un intento de engaño.
    for (const correo of ['ana@gmail.com', 'ana.unisabana.edu.co', '@unisabana.edu.co',
        'ana@unisabana.edu.co.falso.com', 'ana@falsounisabana.edu.co']) {
        test(`rechaza el correo "${correo}"`, () => {
            assert.throws(() => new Usuario(correo, 'Ana', 'pasajero'), /@unisabana.edu.co/);
        });
    }

    test('rechaza un rol que no existe', () => {
        assert.throws(() => new Usuario('ana@unisabana.edu.co', 'Ana', 'admin'), /pasajero o conductor/);
    });

    test('rechaza un usuario sin nombre', () => {
        assert.throws(() => new Usuario('ana@unisabana.edu.co', '', 'pasajero'), /Faltan/);
    });
});

describe('Unitaria - CodigoVerificacion', () => {
    const DIEZ_MINUTOS = 10 * 60 * 1000;

    test('vence 10 minutos después de crearse', () => {
        const codigo = CodigoVerificacion.crear('ana@unisabana.edu.co', '123456', 0);
        assert.strictEqual(codigo.expira, DIEZ_MINUTOS);
    });

    test('se acepta justo al minuto 10 (valor límite)', () => {
        const codigo = CodigoVerificacion.crear('ana@unisabana.edu.co', '123456', 0);
        assert.doesNotThrow(() => codigo.validar('123456', DIEZ_MINUTOS));
    });

    test('se rechaza un milisegundo después del minuto 10', () => {
        const codigo = CodigoVerificacion.crear('ana@unisabana.edu.co', '123456', 0);
        assert.throws(() => codigo.validar('123456', DIEZ_MINUTOS + 1), /venció/);
    });

    test('se rechaza un código distinto', () => {
        const codigo = CodigoVerificacion.crear('ana@unisabana.edu.co', '123456', 0);
        assert.throws(() => codigo.validar('654321', 0), /no es correcto/);
    });

    test('acepta el código aunque tenga espacios alrededor', () => {
        const codigo = CodigoVerificacion.crear('ana@unisabana.edu.co', '123456', 0);
        assert.doesNotThrow(() => codigo.validar(' 123456 ', 0));
    });
});
