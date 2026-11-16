// aplicacion/ServicioEmergencia.js
// Casos de uso del contacto de emergencia (Reto 2).
// La alerta se intenta por cada canal en orden: si uno falla, se pasa al siguiente.
const ContactoEmergencia = require('../dominio/ContactoEmergencia');

class ServicioEmergencia {
    constructor(repositorio, canales = []) {
        this.repositorio = repositorio; // IRepositorioViajes
        this.canales = canales;         // lista de INotificador, en orden de prioridad
    }

    registrarContacto(usuarioId, nombre, telefono) {
        const contacto = new ContactoEmergencia(usuarioId, nombre, telefono);
        return this.repositorio.guardarContacto(contacto);
    }

    buscarContacto(usuarioId) {
        return this.repositorio.buscarContacto(usuarioId);
    }

    // Botón de pánico. El viaje y la ubicación son opcionales: aunque falten, igual se avisa.
    activarAlerta(usuarioId, viajeId = null, ubicacion = null) {
        const contacto = this.repositorio.buscarContacto(usuarioId);
        if (!contacto) {
            throw new Error('El usuario no tiene contacto de emergencia registrado');
        }
        let viaje = null;
        if (viajeId) {
            viaje = this.repositorio.buscarViajePorId(viajeId);
            if (!viaje) {
                throw new Error('Viaje no encontrado');
            }
        }

        let mensaje = `ALERTA de ${usuarioId}: activó el botón de pánico en WHEELS.`;
        if (viaje) {
            mensaje += ` Viaje ${viaje.puntoInicio} -> ${viaje.puntoFinal}, ` +
                `${viaje.fecha} ${viaje.hora}, conductor ${viaje.conductorId}`;
            const vehiculo = this.repositorio.buscarVehiculo(viaje.conductorId);
            mensaje += vehiculo ? `, placa ${vehiculo.placa}.` : '.';
        }
        if (ubicacion && Number.isFinite(Number(ubicacion.lat)) && Number.isFinite(Number(ubicacion.lon))) {
            mensaje += ` Ubicación: https://maps.google.com/?q=${ubicacion.lat},${ubicacion.lon}`;
        }

        for (const canal of this.canales) {
            try {
                canal.notificar(viaje, mensaje, contacto);
                return { enviada: true, canal: canal.nombre, contacto: contacto.nombre };
            } catch (error) {
                // Este canal falló: se intenta con el siguiente.
            }
        }
        return { enviada: false, canal: null, contacto: contacto.nombre };
    }
}

module.exports = ServicioEmergencia;
