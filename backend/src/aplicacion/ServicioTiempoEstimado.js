// aplicacion/ServicioTiempoEstimado.js
// Reto 3: cuánto se demora el usuario desde donde está hasta el destino del viaje.
// Decisiones de arquitectura:
// - Rendimiento: CACHÉ. Las rutas ya calculadas se guardan unos minutos y las
//   direcciones ya ubicadas no se vuelven a buscar.
// - Disponibilidad: RESPALDO. Si el servicio externo falla, se usa el cálculo estimado.
const MINUTOS_EN_CACHE = 5;

class ServicioTiempoEstimado {
    constructor(repositorio, rutasPrincipal, rutasRespaldo, { usarCache = true } = {}) {
        this.usarCache = usarCache;           // se puede apagar para comparar en las pruebas de carga
        this.repositorio = repositorio;       // IRepositorioViajes
        this.rutasPrincipal = rutasPrincipal; // IServicioRutas (ej. OpenStreetMap)
        this.rutasRespaldo = rutasRespaldo;   // IServicioRutas (cálculo estimado)
        this.cacheDirecciones = new Map();    // "universidad de la sabana" -> promesa de { lat, lon }
        this.cacheRutas = new Map();          // "4.755,-74.046,4.862,-74.033" -> { promesa, guardadoEn }
    }

    async calcularParaViaje(viajeId, origen, ahora = Date.now()) {
        const lat = Number(origen.lat);
        const lon = Number(origen.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
            throw new Error('La ubicación de origen no es válida');
        }
        const viaje = this.repositorio.buscarViajePorId(viajeId);
        if (!viaje) {
            throw new Error('Viaje no encontrado');
        }

        const destino = await this._coordenadasDe(viaje.puntoFinal);
        const { ruta, fuente, desdeCache } = await this._rutaEntre({ lat, lon }, destino, ahora);

        return {
            viajeId: viaje.id,
            destino: viaje.puntoFinal,
            distanciaKm: Math.round(ruta.distanciaKm * 10) / 10,
            minutos: Math.max(1, Math.round(ruta.minutos)),
            fuente,
            desdeCache,
        };
    }

    async _coordenadasDe(direccion) {
        const clave = direccion.trim().toLowerCase();
        if (!this.usarCache || !this.cacheDirecciones.has(clave)) {
            // Se guarda la promesa: si llegan muchas consultas iguales al mismo tiempo,
            // todas esperan la misma respuesta en vez de llamar al servicio muchas veces.
            const promesa = this._conRespaldo(servicio => servicio.buscarCoordenadas(direccion))
                .then(({ resultado }) => resultado);
            this.cacheDirecciones.set(clave, promesa);
            promesa.catch(() => this.cacheDirecciones.delete(clave)); // un error no se guarda
        }
        return this.cacheDirecciones.get(clave);
    }

    async _rutaEntre(origen, destino, ahora) {
        // Se redondea a 3 decimales (~100 m): dos personas muy cerca comparten la misma ruta en caché.
        const clave = [origen.lat, origen.lon, destino.lat, destino.lon].map(n => n.toFixed(3)).join(',');
        const guardada = this.cacheRutas.get(clave);
        if (this.usarCache && guardada && ahora - guardada.guardadoEn < MINUTOS_EN_CACHE * 60 * 1000) {
            const { resultado, fuente } = await guardada.promesa;
            return { ruta: resultado, fuente, desdeCache: true };
        }
        const promesa = this._conRespaldo(servicio => servicio.calcularRuta(origen, destino));
        this.cacheRutas.set(clave, { promesa, guardadoEn: ahora });
        promesa.catch(() => this.cacheRutas.delete(clave));
        const { resultado, fuente } = await promesa;
        return { ruta: resultado, fuente, desdeCache: false };
    }

    // Intenta con el servicio principal; si falla, usa el de respaldo.
    async _conRespaldo(operacion) {
        try {
            return { resultado: await operacion(this.rutasPrincipal), fuente: this.rutasPrincipal.nombre };
        } catch (error) {
            return { resultado: await operacion(this.rutasRespaldo), fuente: this.rutasRespaldo.nombre };
        }
    }
}

ServicioTiempoEstimado.MINUTOS_EN_CACHE = MINUTOS_EN_CACHE;
module.exports = ServicioTiempoEstimado;
