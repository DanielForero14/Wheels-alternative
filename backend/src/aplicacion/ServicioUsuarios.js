// aplicacion/ServicioUsuarios.js
// Casos de uso de ingreso: pedir un código al correo institucional y verificarlo.
const Usuario = require('../dominio/Usuario');
const CodigoVerificacion = require('../dominio/CodigoVerificacion');

class ServicioUsuarios {
    constructor(repositorio, generadorCodigo, notificadorCorreo) {
        this.repositorio = repositorio;             // IRepositorioViajes
        this.generadorCodigo = generadorCodigo;     // IGeneradorCodigo
        this.notificadorCorreo = notificadorCorreo; // INotificador (correo simulado)
    }

    solicitarCodigo(nombre, correo, rol, ahora = Date.now()) {
        const anterior = this.repositorio.buscarUsuario(Usuario.normalizarCorreo(correo));
        const usuario = new Usuario(correo, nombre, rol, anterior ? anterior.verificado : false);
        this.repositorio.guardarUsuario(usuario);

        const codigo = CodigoVerificacion.crear(usuario.correo, this.generadorCodigo.generarCodigoNumerico(6), ahora);
        this.repositorio.guardarCodigoVerificacion(codigo);

        this.notificadorCorreo.notificar(null, `Tu código de ingreso a WHEELS es ${codigo.codigo}`, usuario);
        return { mensaje: `Enviamos un código a ${usuario.correo}` };
    }

    verificarCodigo(correo, codigoEscrito, ahora = Date.now()) {
        const correoLimpio = Usuario.normalizarCorreo(correo);
        const codigo = this.repositorio.buscarCodigoVerificacion(correoLimpio);
        if (!codigo) {
            throw new Error('Primero pide un código de ingreso');
        }
        codigo.validar(codigoEscrito, ahora);

        const usuario = this.repositorio.buscarUsuario(correoLimpio);
        usuario.verificado = true;
        this.repositorio.guardarUsuario(usuario);
        this.repositorio.borrarCodigoVerificacion(correoLimpio); // un código solo sirve una vez
        return usuario;
    }

    // Lo usan los demás casos de uso: solo los estudiantes verificados pueden actuar.
    exigirUsuarioVerificado(correo, rol) {
        const usuario = this.repositorio.buscarUsuario(Usuario.normalizarCorreo(correo));
        if (!usuario || !usuario.verificado) {
            throw new Error('El usuario no ha verificado su correo');
        }
        if (rol && usuario.rol !== rol) {
            throw new Error(`Esta acción es solo para el rol ${rol}`);
        }
        return usuario;
    }
}

module.exports = ServicioUsuarios;
