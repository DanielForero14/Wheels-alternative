// dominio/Usuario.js
// Estudiante que usa WHEELS. Solo se aceptan correos institucionales de La Sabana.
const DOMINIO_PERMITIDO = '@unisabana.edu.co';
const ROLES = ['pasajero', 'conductor'];

class Usuario {
    constructor(correo, nombre, rol, verificado = false) {
        const correoLimpio = Usuario.normalizarCorreo(correo);
        if (!nombre || !correoLimpio) {
            throw new Error('Faltan el nombre o el correo');
        }
        if (!Usuario.esCorreoInstitucional(correoLimpio)) {
            throw new Error('Solo pueden ingresar estudiantes con correo @unisabana.edu.co');
        }
        if (!ROLES.includes(rol)) {
            throw new Error('El rol debe ser pasajero o conductor');
        }
        this.correo = correoLimpio;
        this.nombre = nombre.trim();
        this.rol = rol;
        this.verificado = verificado;
    }

    static normalizarCorreo(correo) {
        return String(correo || '').trim().toLowerCase();
    }

    // Debe terminar exactamente en @unisabana.edu.co y tener algo antes de la arroba.
    static esCorreoInstitucional(correo) {
        return /^[a-z0-9._%+-]+@unisabana\.edu\.co$/.test(correo);
    }
}

Usuario.DOMINIO_PERMITIDO = DOMINIO_PERMITIDO;
module.exports = Usuario;
