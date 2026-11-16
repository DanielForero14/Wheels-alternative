// adaptadores/entrada/http/crearApp.js
// Adaptador de entrada: traduce las peticiones HTTP a llamadas a los casos de uso.
// Aquí no hay reglas de negocio, solo se reciben datos y se devuelven respuestas.
//
// Autenticación (Corte 3): /auth/verificar entrega un token de sesión. Todas las demás rutas,
// salvo "/" y "/salud", exigen "Authorization: Bearer <token>". El usuario que actúa SIEMPRE
// sale del token, nunca del cuerpo de la petición (antes se confiaba en conductorId/pasajeroId).
//   401 = falta el token, está alterado o venció.
//   403 = el usuario está identificado, pero no le corresponde esa acción.
const express = require('express');
const Usuario = require('../../../dominio/Usuario');
const ErrorDeAutorizacion = require('../../../dominio/ErrorDeAutorizacion');

function crearApp({
    servicioUsuarios, servicioViajes, servicioReservas, servicioEmergencia, servicioTiempoEstimado,
    emisorTokens, version = 'desconocida',
}) {
    const app = express();
    app.disable('x-powered-by'); // no anunciar la tecnología del servidor
    app.use(express.json({ limit: '20kb' }));

    // Permite que la app en modo web (otro puerto) pueda llamar a la API.
    app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
        res.header('X-Content-Type-Options', 'nosniff');
        if (req.method === 'OPTIONS') {
            return res.status(204).end();
        }
        next();
    });

    // 403 para las reglas de autorización del núcleo; 400 para el resto de reglas de negocio.
    const responderError = (res, error) =>
        res.status(error instanceof ErrorDeAutorizacion ? 403 : 400).json({ error: error.message });

    // ---------- Sesión ----------
    const exigirSesion = (req, res, next) => {
        const [tipo, token] = String(req.headers.authorization || '').split(' ');
        const sesion = tipo === 'Bearer' ? emisorTokens.verificar(token) : null;
        if (!sesion) {
            return res.status(401).json({ error: 'Inicia sesión para continuar' });
        }
        req.usuario = sesion; // { correo, rol }
        next();
    };

    // Las rutas /usuarios/:correo/... solo las puede usar el dueño de ese correo.
    const soloElMismoUsuario = (req, res, next) => {
        if (Usuario.normalizarCorreo(req.params.correo) !== req.usuario.correo) {
            return res.status(403).json({ error: 'Solo puedes consultar o cambiar tu propia información' });
        }
        next();
    };

    // ---------- Rutas públicas ----------
    app.get('/', (req, res) => {
        res.send('API WHEELS funcionando');
    });

    // Healthcheck: lo usan Docker Compose, el despliegue y la prueba de humo. No depende de servicios externos.
    app.get('/salud', (req, res) => {
        res.json({ estado: 'ok', version });
    });

    // ---------- Ingreso con correo institucional ----------
    app.post('/auth/solicitar-codigo', (req, res) => {
        try {
            const { nombre, correo, rol } = req.body;
            res.json(servicioUsuarios.solicitarCodigo(nombre, correo, rol));
        } catch (error) {
            responderError(res, error);
        }
    });

    // Al verificar el código se entrega el token de sesión.
    app.post('/auth/verificar', (req, res) => {
        try {
            const usuario = servicioUsuarios.verificarCodigo(req.body.correo, req.body.codigo);
            res.json({ ...usuario, token: emisorTokens.emitir(usuario) });
        } catch (error) {
            responderError(res, error);
        }
    });

    // ---------- Desde aquí todo exige sesión ----------
    app.use(exigirSesion);

    // ---------- Viajes (Reto 3: planeación) ----------
    app.post('/viajes', (req, res) => {
        try {
            const viaje = servicioViajes.programarViaje({ ...req.body, conductorId: req.usuario.correo });
            res.status(201).json(viaje);
        } catch (error) {
            responderError(res, error);
        }
    });

    // Sin filtros lista todos los disponibles. Filtros opcionales: ?fecha=&origen=&destino=
    app.get('/viajes', (req, res) => {
        const { fecha, origen, destino } = req.query;
        res.json(servicioViajes.buscarViajes({ fecha, origen, destino }));
    });

    app.post('/viajes/:id/cancelar', (req, res) => {
        try {
            res.json(servicioViajes.cancelarViaje(Number(req.params.id), req.usuario.correo));
        } catch (error) {
            responderError(res, error);
        }
    });

    // Reto 3: cuánto se demora el usuario desde donde está (?lat=&lon=) hasta el destino del viaje
    app.get('/viajes/:id/tiempo-estimado', async (req, res) => {
        try {
            const origen = { lat: req.query.lat, lon: req.query.lon };
            res.json(await servicioTiempoEstimado.calcularParaViaje(Number(req.params.id), origen));
        } catch (error) {
            responderError(res, error);
        }
    });

    // Vehículo del conductor: placa y descripción (marca, color...)
    app.get('/usuarios/:correo/vehiculo', soloElMismoUsuario, (req, res) => {
        const vehiculo = servicioViajes.vehiculoDelConductor(req.usuario.correo);
        if (!vehiculo) {
            return res.status(404).json({ error: 'No hay vehículo registrado' });
        }
        res.json(vehiculo);
    });

    app.put('/usuarios/:correo/vehiculo', soloElMismoUsuario, (req, res) => {
        try {
            res.json(servicioViajes.registrarVehiculo(req.usuario.correo, req.body.placa, req.body.descripcion));
        } catch (error) {
            responderError(res, error);
        }
    });

    // Viajes que programó un conductor
    app.get('/usuarios/:correo/viajes', soloElMismoUsuario, (req, res) => {
        res.json(servicioViajes.viajesDelConductor(req.usuario.correo));
    });

    // ---------- Reservas y QR (Reto 1) ----------
    // El pasajero solicita un cupo con su punto de recogida. Queda pendiente.
    app.post('/viajes/:id/reservar', (req, res) => {
        try {
            const reserva = servicioReservas.solicitarCupo(Number(req.params.id), req.usuario.correo, req.body.puntoRecogida);
            res.status(201).json({ reserva });
        } catch (error) {
            responderError(res, error);
        }
    });

    // El conductor ve las solicitudes de sus viajes
    app.get('/usuarios/:correo/solicitudes', soloElMismoUsuario, (req, res) => {
        res.json(servicioReservas.solicitudesDelConductor(req.usuario.correo));
    });

    // El conductor acepta (se genera el QR) o rechaza una solicitud
    const responder = (aceptar) => async (req, res) => {
        try {
            res.json(await servicioReservas.responderSolicitud(Number(req.params.id), req.usuario.correo, aceptar));
        } catch (error) {
            responderError(res, error);
        }
    };
    app.post('/reservas/:id/aceptar', responder(true));
    app.post('/reservas/:id/rechazar', responder(false));

    app.get('/usuarios/:correo/reservas', soloElMismoUsuario, async (req, res) => {
        res.json(await servicioReservas.reservasDelPasajero(req.usuario.correo));
    });

    app.post('/viajes/:id/abordar', (req, res) => {
        try {
            const reserva = servicioReservas.validarAbordaje(Number(req.params.id), req.body.codigo, req.usuario.correo);
            res.json({ mensaje: 'Abordaje confirmado', reserva });
        } catch (error) {
            responderError(res, error);
        }
    });

    // ---------- Contacto de emergencia (Reto 2) ----------
    app.get('/usuarios/:correo/contacto-emergencia', soloElMismoUsuario, (req, res) => {
        const contacto = servicioEmergencia.buscarContacto(req.usuario.correo);
        if (!contacto) {
            return res.status(404).json({ error: 'No hay contacto registrado' });
        }
        res.json(contacto);
    });

    app.put('/usuarios/:correo/contacto-emergencia', soloElMismoUsuario, (req, res) => {
        try {
            const contacto = servicioEmergencia.registrarContacto(req.usuario.correo, req.body.nombre, req.body.telefono);
            res.json(contacto);
        } catch (error) {
            responderError(res, error);
        }
    });

    // Botón de pánico. viajeId y ubicacion ({ lat, lon }) son opcionales.
    app.post('/emergencias', (req, res) => {
        try {
            const viajeId = req.body.viajeId ? Number(req.body.viajeId) : null;
            const resultado = servicioEmergencia.activarAlerta(req.usuario.correo, viajeId, req.body.ubicacion);
            // 503 = ningún canal pudo entregar la alerta
            res.status(resultado.enviada ? 200 : 503).json(resultado);
        } catch (error) {
            responderError(res, error);
        }
    });

    // Errores no esperados (por ejemplo, un JSON mal formado): respuesta genérica, sin detalles internos.
    // eslint-disable-next-line no-unused-vars
    app.use((error, req, res, next) => {
        const status = error.status && error.status < 500 ? error.status : 500;
        res.status(status).json({ error: status === 500 ? 'Error interno del servidor' : 'Petición inválida' });
    });

    return app;
}

module.exports = crearApp;
