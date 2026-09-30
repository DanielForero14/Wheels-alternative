// dominio/ViajeFactory.js
// Patrón Factory Method (viene del Corte 1): centraliza la creación de viajes
// y valida los datos antes de construirlos.
// En el Corte 2 se agregan las reglas de planeación (fecha futura y cupos).
const Viaje = require('./Viaje');

const CUPOS_MINIMOS = 1;
const CUPOS_MAXIMOS = 6;

// Fecha de hoy en la hora local del computador, con formato AAAA-MM-DD.
function fechaDeHoy() {
    const hoy = new Date();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');
    return `${hoy.getFullYear()}-${mes}-${dia}`;
}

class ViajeFactory {
    // "hoy" se puede pasar desde afuera para poder probar las fechas límite.
    static crearViaje({ conductorId, puntoInicio, puntoFinal, fecha, hora, cuposDisponibles, descripcionRuta }, hoy = fechaDeHoy()) {
        if (!conductorId || !puntoInicio || !puntoFinal || !fecha || !hora) {
            throw new Error('Faltan datos obligatorios para crear el viaje');
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
            throw new Error('La fecha debe tener el formato AAAA-MM-DD');
        }
        if (!/^\d{2}:\d{2}$/.test(hora)) {
            throw new Error('La hora debe tener el formato HH:MM');
        }
        if (fecha < hoy) {
            throw new Error('No se puede programar un viaje en una fecha pasada');
        }

        const cupos = Number(cuposDisponibles);
        if (!Number.isInteger(cupos) || cupos < CUPOS_MINIMOS || cupos > CUPOS_MAXIMOS) {
            throw new Error(`Los cupos deben estar entre ${CUPOS_MINIMOS} y ${CUPOS_MAXIMOS}`);
        }

        const ruta = String(descripcionRuta || '').trim();
        if (ruta.length > 200) {
            throw new Error('La descripción de la ruta no puede tener más de 200 caracteres');
        }

        // El id lo asigna el repositorio al guardar el viaje.
        return new Viaje(null, conductorId, puntoInicio, puntoFinal, fecha, hora, cupos, 'disponible', ruta);
    }
}

module.exports = ViajeFactory;
