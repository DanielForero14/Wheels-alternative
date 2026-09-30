// configuracion.js
// Aquí se conecta cada puerto con su adaptador (inyección de dependencias).
// Es el único archivo que conoce a la vez el núcleo y los adaptadores.
const RepositorioSQLite = require('./adaptadores/salida/persistencia/RepositorioSQLite');
const GeneradorCodigoQR = require('./adaptadores/salida/qr/GeneradorCodigoQR');
const ConsolaNotificador = require('./adaptadores/salida/notificaciones/ConsolaNotificador');
const AppNotificador = require('./adaptadores/salida/notificaciones/AppNotificador');
const EmergenciaNotificador = require('./adaptadores/salida/notificaciones/EmergenciaNotificador');
const ServicioViajes = require('./aplicacion/ServicioViajes');
const ServicioReservas = require('./aplicacion/ServicioReservas');
const ServicioEmergencia = require('./aplicacion/ServicioEmergencia');
const ServicioUsuarios = require('./aplicacion/ServicioUsuarios');
const ServicioTiempoEstimado = require('./aplicacion/ServicioTiempoEstimado');
const RutasOpenStreetMap = require('./adaptadores/salida/rutas/RutasOpenStreetMap');
const RutasEstimadas = require('./adaptadores/salida/rutas/RutasEstimadas');
const RutasSimuladasLentas = require('./adaptadores/salida/rutas/RutasSimuladasLentas');
const crearApp = require('./adaptadores/entrada/http/crearApp');
const { cargarDatosDePrueba } = require('./datosDePrueba');

// rutaBD = null -> base de datos en memoria (se usa en las pruebas)
// datosDePrueba = true -> carga 500 viajes de ejemplo y simula un servicio de rutas lento (pruebas de carga)
// rutasPrincipal -> permite cambiar el servicio de rutas (en las pruebas no se usa internet)
// usarCacheRutas = false -> apaga el caché de rutas para comparar en las pruebas de carga
async function armarApp({
    rutaBD = null,
    simularFallaSMS = false,
    datosDePrueba = false,
    rutasPrincipal = null,
    usarCacheRutas = true,
} = {}) {
    const repositorio = await RepositorioSQLite.crear(rutaBD);
    const notificadores = [new ConsolaNotificador(), new AppNotificador()];

    // Canales de emergencia en orden: primero SMS, si falla se usa el correo.
    const canalesEmergencia = [new EmergenciaNotificador(simularFallaSMS), new ConsolaNotificador()];

    const generadorCodigo = new GeneradorCodigoQR();
    const servicioUsuarios = new ServicioUsuarios(repositorio, generadorCodigo, new ConsolaNotificador());
    const servicioViajes = new ServicioViajes(repositorio, servicioUsuarios, notificadores);
    const servicioReservas = new ServicioReservas(repositorio, generadorCodigo, servicioUsuarios, notificadores);
    const servicioEmergencia = new ServicioEmergencia(repositorio, canalesEmergencia);

    // Reto 3: rutas reales de OpenStreetMap y, si fallan, el cálculo estimado.
    const principal = rutasPrincipal || (datosDePrueba ? new RutasSimuladasLentas() : new RutasOpenStreetMap());
    const servicioTiempoEstimado = new ServicioTiempoEstimado(
        repositorio, principal, new RutasEstimadas(), { usarCache: usarCacheRutas }
    );

    if (datosDePrueba) {
        cargarDatosDePrueba(repositorio, servicioViajes);
    }

    return crearApp({ servicioUsuarios, servicioViajes, servicioReservas, servicioEmergencia, servicioTiempoEstimado });
}

module.exports = armarApp;
