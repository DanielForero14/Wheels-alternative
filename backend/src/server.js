// backend/src/server.js
const express = require('express');
const ViajeFactory = require('./factoria/ViajeFactory');
const GestorViajes = require('./modelo/GestorViajes');
const ConsolaNotificador = require('./notificaciones/ConsolaNotificador');
const AppNotificador = require('./notificaciones/AppNotificador');

const app = express();
app.use(express.json());

// Inyección de dependencias: GestorViajes no crea sus propios notificadores,
// los recibe ya construidos (DIP).
const gestor = new GestorViajes();
gestor.agregarObservador(new ConsolaNotificador());
gestor.agregarObservador(new AppNotificador());

// Ruta de prueba
app.get('/', (req, res) => {
    res.send('API Transporte Universitario funcionando');
});

// Crear un viaje (usa el Factory Method)
app.post('/viajes', (req, res) => {
    try {
        const viaje = ViajeFactory.crearViaje(req.body);
        gestor.agregarViaje(viaje);
        res.status(201).json(viaje);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Listar viajes disponibles
app.get('/viajes', (req, res) => {
    res.json(gestor.listarDisponibles());
});

// Reservar un cupo (dispara el Observer -> notifica)
app.post('/viajes/:id/reservar', (req, res) => {
    try {
        const viaje = gestor.reservarViaje(Number(req.params.id));
        res.json(viaje);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Cancelar un viaje (dispara el Observer -> notifica)
app.post('/viajes/:id/cancelar', (req, res) => {
    try {
        const viaje = gestor.cancelarViaje(Number(req.params.id));
        res.json(viaje);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});