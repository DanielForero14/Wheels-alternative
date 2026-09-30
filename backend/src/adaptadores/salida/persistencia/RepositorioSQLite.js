// adaptadores/salida/persistencia/RepositorioSQLite.js
// Implementa IRepositorioViajes con una base de datos SQLite (Reto 3).
// Usa la librería "sql.js" (SQLite compilado a JavaScript), así no hay que
// instalar nada extra en el computador.
// - Si se pasa una ruta de archivo, los datos se guardan en ese archivo.
// - Si no, la base vive en memoria (se usa en las pruebas de integración).
const fs = require('fs');
const initSqlJs = require('sql.js');
const IRepositorioViajes = require('../../../puertos/IRepositorioViajes');
const Viaje = require('../../../dominio/Viaje');
const Reserva = require('../../../dominio/Reserva');
const ContactoEmergencia = require('../../../dominio/ContactoEmergencia');
const Usuario = require('../../../dominio/Usuario');
const CodigoVerificacion = require('../../../dominio/CodigoVerificacion');

const TABLAS = `
    CREATE TABLE IF NOT EXISTS viajes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conductorId TEXT, puntoInicio TEXT, puntoFinal TEXT,
        fecha TEXT, hora TEXT, cuposDisponibles INTEGER, estado TEXT, descripcionRuta TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_viajes_busqueda ON viajes (estado, fecha);
    CREATE TABLE IF NOT EXISTS reservas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        viajeId INTEGER, pasajeroId TEXT, codigo TEXT UNIQUE,
        expira INTEGER, usada INTEGER, estado TEXT, puntoRecogida TEXT
    );
    CREATE TABLE IF NOT EXISTS contactos (
        usuarioId TEXT PRIMARY KEY, nombre TEXT, telefono TEXT
    );
    CREATE TABLE IF NOT EXISTS usuarios (
        correo TEXT PRIMARY KEY, nombre TEXT, rol TEXT, verificado INTEGER
    );
    CREATE TABLE IF NOT EXISTS codigos_verificacion (
        correo TEXT PRIMARY KEY, codigo TEXT, expira INTEGER
    );
`;

class RepositorioSQLite extends IRepositorioViajes {
    // Se crea con "await RepositorioSQLite.crear(ruta)" porque sql.js carga de forma asíncrona.
    static async crear(rutaArchivo = null) {
        const SQL = await initSqlJs();
        let db;
        if (rutaArchivo && fs.existsSync(rutaArchivo)) {
            db = new SQL.Database(fs.readFileSync(rutaArchivo));
        } else {
            db = new SQL.Database();
        }
        db.run(TABLAS);
        // Si el archivo wheels.db es de una versión anterior, se agregan las columnas nuevas.
        for (const columna of [
            'ALTER TABLE viajes ADD COLUMN descripcionRuta TEXT',
            "ALTER TABLE reservas ADD COLUMN estado TEXT DEFAULT 'aceptada'",
            'ALTER TABLE reservas ADD COLUMN puntoRecogida TEXT',
        ]) {
            try { db.run(columna); } catch (e) { /* la columna ya existe */ }
        }
        return new RepositorioSQLite(db, rutaArchivo);
    }

    constructor(db, rutaArchivo) {
        super();
        this.db = db;
        this.rutaArchivo = rutaArchivo;
    }

    // ---------- Viajes ----------
    guardarViaje(viaje) {
        this._ejecutar(
            'INSERT INTO viajes (conductorId, puntoInicio, puntoFinal, fecha, hora, cuposDisponibles, estado, descripcionRuta) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [viaje.conductorId, viaje.puntoInicio, viaje.puntoFinal, viaje.fecha, viaje.hora, viaje.cuposDisponibles, viaje.estado, viaje.descripcionRuta || '']
        );
        viaje.id = this.ultimoIdInsertado;
        return viaje;
    }

    actualizarViaje(viaje) {
        this._ejecutar('UPDATE viajes SET cuposDisponibles = ?, estado = ? WHERE id = ?',
            [viaje.cuposDisponibles, viaje.estado, viaje.id]);
        return viaje;
    }

    buscarViajePorId(id) {
        const filas = this._consultar('SELECT * FROM viajes WHERE id = ?', [id]);
        return filas.length ? this._aViaje(filas[0]) : null;
    }

    buscarViajes({ fecha, origen, destino } = {}) {
        let sql = "SELECT * FROM viajes WHERE estado = 'disponible'";
        const parametros = [];
        if (fecha) { sql += ' AND fecha = ?'; parametros.push(fecha); }
        if (origen) { sql += ' AND puntoInicio LIKE ?'; parametros.push(`%${origen}%`); }
        if (destino) { sql += ' AND puntoFinal LIKE ?'; parametros.push(`%${destino}%`); }
        sql += ' ORDER BY fecha, hora LIMIT 50';
        return this._consultar(sql, parametros).map(f => this._aViaje(f));
    }

    buscarViajesDeConductor(conductorId) {
        return this._consultar('SELECT * FROM viajes WHERE conductorId = ? ORDER BY fecha, hora', [conductorId])
            .map(f => this._aViaje(f));
    }

    // ---------- Reservas ----------
    guardarReserva(reserva) {
        this._ejecutar(
            'INSERT INTO reservas (viajeId, pasajeroId, codigo, expira, usada, estado, puntoRecogida) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [reserva.viajeId, reserva.pasajeroId, reserva.codigo, reserva.expira, reserva.usada ? 1 : 0, reserva.estado, reserva.puntoRecogida]
        );
        reserva.id = this.ultimoIdInsertado;
        return reserva;
    }

    actualizarReserva(reserva) {
        this._ejecutar('UPDATE reservas SET usada = ?, estado = ?, codigo = ?, expira = ? WHERE id = ?',
            [reserva.usada ? 1 : 0, reserva.estado, reserva.codigo, reserva.expira, reserva.id]);
        return reserva;
    }

    buscarReservaPorCodigo(codigo) {
        const filas = this._consultar('SELECT * FROM reservas WHERE codigo = ?', [codigo]);
        return filas.length ? this._aReserva(filas[0]) : null;
    }

    buscarReserva(viajeId, pasajeroId) {
        const filas = this._consultar('SELECT * FROM reservas WHERE viajeId = ? AND pasajeroId = ?', [viajeId, pasajeroId]);
        return filas.length ? this._aReserva(filas[0]) : null;
    }

    buscarReservasDeViaje(viajeId) {
        return this._consultar('SELECT * FROM reservas WHERE viajeId = ? ORDER BY id', [viajeId]).map(f => this._aReserva(f));
    }

    buscarReservaPorId(id) {
        const filas = this._consultar('SELECT * FROM reservas WHERE id = ?', [id]);
        return filas.length ? this._aReserva(filas[0]) : null;
    }

    buscarReservasDePasajero(pasajeroId) {
        return this._consultar('SELECT * FROM reservas WHERE pasajeroId = ? ORDER BY id DESC', [pasajeroId])
            .map(f => this._aReserva(f));
    }

    // ---------- Contactos de emergencia ----------
    guardarContacto(contacto) {
        this._ejecutar('INSERT OR REPLACE INTO contactos (usuarioId, nombre, telefono) VALUES (?, ?, ?)',
            [contacto.usuarioId, contacto.nombre, contacto.telefono]);
        return contacto;
    }

    buscarContacto(usuarioId) {
        const filas = this._consultar('SELECT * FROM contactos WHERE usuarioId = ?', [usuarioId]);
        if (!filas.length) return null;
        const f = filas[0];
        return new ContactoEmergencia(f.usuarioId, f.nombre, f.telefono);
    }

    // ---------- Usuarios y códigos de verificación ----------
    guardarUsuario(usuario) {
        this._ejecutar('INSERT OR REPLACE INTO usuarios (correo, nombre, rol, verificado) VALUES (?, ?, ?, ?)',
            [usuario.correo, usuario.nombre, usuario.rol, usuario.verificado ? 1 : 0]);
        return usuario;
    }

    buscarUsuario(correo) {
        const filas = this._consultar('SELECT * FROM usuarios WHERE correo = ?', [correo]);
        if (!filas.length) return null;
        const f = filas[0];
        return new Usuario(f.correo, f.nombre, f.rol, f.verificado === 1);
    }

    guardarCodigoVerificacion(codigo) {
        this._ejecutar('INSERT OR REPLACE INTO codigos_verificacion (correo, codigo, expira) VALUES (?, ?, ?)',
            [codigo.correo, codigo.codigo, codigo.expira]);
        return codigo;
    }

    buscarCodigoVerificacion(correo) {
        const filas = this._consultar('SELECT * FROM codigos_verificacion WHERE correo = ?', [correo]);
        if (!filas.length) return null;
        const f = filas[0];
        return new CodigoVerificacion(f.correo, f.codigo, f.expira);
    }

    borrarCodigoVerificacion(correo) {
        this._ejecutar('DELETE FROM codigos_verificacion WHERE correo = ?', [correo]);
    }

    // ---------- Ayudas internas ----------
    _ejecutar(sql, parametros) {
        this.db.run(sql, parametros);
        // Se lee el id antes de guardar el archivo (al exportar, sql.js reinicia este valor).
        this.ultimoIdInsertado = this.db.exec('SELECT last_insert_rowid()')[0].values[0][0];
        this._guardarEnArchivo();
    }

    _consultar(sql, parametros) {
        const consulta = this.db.prepare(sql);
        consulta.bind(parametros);
        const filas = [];
        while (consulta.step()) {
            filas.push(consulta.getAsObject());
        }
        consulta.free();
        return filas;
    }

    _guardarEnArchivo() {
        if (this.rutaArchivo) {
            fs.writeFileSync(this.rutaArchivo, Buffer.from(this.db.export()));
        }
    }

    _aViaje(f) {
        return new Viaje(f.id, f.conductorId, f.puntoInicio, f.puntoFinal, f.fecha, f.hora, f.cuposDisponibles, f.estado, f.descripcionRuta || '');
    }

    _aReserva(f) {
        return new Reserva(f.id, f.viajeId, f.pasajeroId, f.codigo, f.expira, f.usada === 1, f.estado || 'aceptada', f.puntoRecogida || '');
    }
}

module.exports = RepositorioSQLite;
