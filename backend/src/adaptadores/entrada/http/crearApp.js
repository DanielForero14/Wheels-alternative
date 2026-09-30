// adaptadores/entrada/http/crearApp.js
// Adaptador de entrada: traduce las peticiones HTTP a llamadas a los casos de uso.
// Aquí no hay reglas de negocio, solo se reciben datos y se devuelven respuestas.
const express = require('express');

function crearApp({ servicioUsuarios, servicioViajes, servicioReservas, servicioEmergencia, servicioTiempoEstimado }) {
    const app = express();
    app.use(express.json());

    // Permite que la app en modo web (otro puerto) pueda llamar a la API.
    app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Headers', 'Content-Type');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
        if (req.method === 'OPTIONS') {
            return res.status(204).end();
        }
        next();
    });

    app.get('/', (req, res) => {
        res.send('API WHEELS funcionando');
    });

    // ---------- Ingreso con correo institucional ----------
    app.post('/auth/solicitar-codigo', (req, res) => {
        try {
            const { nombre, correo, rol } = req.body;
            res.json(servicioUsuarios.solicitarCodigo(nombre, correo, rol));
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });

    app.post('/auth/verificar', (req, res) => {
        try {
            res.json(servicioUsuarios.verificarCodigo(req.body.correo, req.body.codigo));
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });

    // ---------- Viajes (Reto 3: planeación) ----------
    app.post('/viajes', (req, res) => {
        try {
            const viaje = servicioViajes.programarViaje(req.body);
            res.status(201).json(viaje);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });

    // Sin filtros lista todos los disponibles. Filtros opcionales: ?fecha=&origen=&destino=
    app.get('/viajes', (req, res) => {
        const { fecha, origen, destino } = req.query;
        res.json(servicioViajes.buscarViajes({ fecha, origen, destino }));
    });

    app.post('/viajes/:id/cancelar', (req, res) => {
        try {
            const viaje = servicioViajes.cancelarViaje(Number(req.params.id));
            res.json(viaje);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });

    // Reto 3: cuánto se demora el usuario desde donde está (?lat=&lon=) hasta el destino del viaje
    app.get('/viajes/:id/tiempo-estimado', async (req, res) => {
        try {
            const origen = { lat: req.query.lat, lon: req.query.lon };
            res.json(await servicioTiempoEstimado.calcularParaViaje(Number(req.params.id), origen));
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });

    // Viajes que programó un conductor
    app.get('/usuarios/:correo/viajes', (req, res) => {
        res.json(servicioViajes.viajesDelConductor(req.params.correo));
    });

    // ---------- Reservas y QR (Reto 1) ----------
    // El pasajero solicita un cupo con su punto de recogida. Queda pendiente.
    app.post('/viajes/:id/reservar', (req, res) => {
        try {
            const reserva = servicioReservas.solicitarCupo(Number(req.params.id), req.body.pasajeroId, req.body.puntoRecogida);
            res.status(201).json({ reserva });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });

    // El conductor ve las solicitudes de sus viajes
    app.get('/usuarios/:correo/solicitudes', (req, res) => {
        res.json(servicioReservas.solicitudesDelConductor(req.params.correo));
    });

    // El conductor acepta (se genera el QR) o rechaza una solicitud
    const responder = (aceptar) => async (req, res) => {
        try {
            res.json(await servicioReservas.responderSolicitud(Number(req.params.id), req.body.conductorId, aceptar));
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    };
    app.post('/reservas/:id/aceptar', responder(true));
    app.post('/reservas/:id/rechazar', responder(false));

    app.get('/usuarios/:correo/reservas', async (req, res) => {
        res.json(await servicioReservas.reservasDelPasajero(req.params.correo));
    });

    app.post('/viajes/:id/abordar', (req, res) => {
        try {
            const reserva = servicioReservas.validarAbordaje(Number(req.params.id), req.body.codigo);
            res.json({ mensaje: 'Abordaje confirmado', reserva });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });

    // ---------- Contacto de emergencia (Reto 2) ----------
    app.get('/usuarios/:correo/contacto-emergencia', (req, res) => {
        const contacto = servicioEmergencia.buscarContacto(req.params.correo);
        if (!contacto) {
            return res.status(404).json({ error: 'No hay contacto registrado' });
        }
        res.json(contacto);
    });

    app.put('/usuarios/:correo/contacto-emergencia', (req, res) => {
        try {
            const contacto = servicioEmergencia.registrarContacto(req.params.correo, req.body.nombre, req.body.telefono);
            res.json(contacto);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });

    // Botón de pánico. viajeId y ubicacion ({ lat, lon }) son opcionales.
    app.post('/emergencias', (req, res) => {
        try {
            const viajeId = req.body.viajeId ? Number(req.body.viajeId) : null;
            const resultado = servicioEmergencia.activarAlerta(req.body.usuarioId, viajeId, req.body.ubicacion);
            // 503 = ningún canal pudo entregar la alerta
            res.status(resultado.enviada ? 200 : 503).json(resultado);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });

    return app;
}

module.exports = crearApp;
