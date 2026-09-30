// datosDePrueba.js
// Carga datos de ejemplo al arrancar con "npm run start:carga".
// Se usa en las pruebas de carga (k6): deja un conductor verificado y 500 viajes
// programados en los próximos 7 días.
const Usuario = require('./dominio/Usuario');

const CONDUCTOR_PRUEBA = 'conductor.prueba@unisabana.edu.co';
const ORIGENES = ['Chía', 'Cajicá', 'Zipaquirá', 'Cota', 'Suba'];

function fechaEnDias(dias) {
    const fecha = new Date(Date.now() + dias * 24 * 60 * 60 * 1000);
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${fecha.getFullYear()}-${mes}-${dia}`;
}

function cargarDatosDePrueba(repositorio, servicioViajes, cantidad = 500) {
    repositorio.guardarUsuario(new Usuario(CONDUCTOR_PRUEBA, 'Conductor de prueba', 'conductor', true));
    for (let i = 0; i < cantidad; i++) {
        servicioViajes.programarViaje({
            conductorId: CONDUCTOR_PRUEBA,
            puntoInicio: ORIGENES[i % ORIGENES.length],
            puntoFinal: 'Universidad',
            fecha: fechaEnDias(1 + (i % 7)),
            hora: `${String(6 + (i % 12)).padStart(2, '0')}:00`,
            cuposDisponibles: 4,
        });
    }
    console.log(`Datos de prueba cargados: ${cantidad} viajes de ${CONDUCTOR_PRUEBA}`);
}

module.exports = { cargarDatosDePrueba, CONDUCTOR_PRUEBA };
