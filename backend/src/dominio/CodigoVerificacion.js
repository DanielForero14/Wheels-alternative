// dominio/CodigoVerificacion.js
// Código de 6 dígitos que se envía al correo para confirmar que el estudiante es dueño de ese correo.
const MINUTOS_DE_VIGENCIA = 10;

class CodigoVerificacion {
    constructor(correo, codigo, expira) {
        this.correo = correo;
        this.codigo = codigo;
        this.expira = expira; // momento (en milisegundos) en que el código vence
    }

    static crear(correo, codigo, ahora) {
        return new CodigoVerificacion(correo, codigo, ahora + MINUTOS_DE_VIGENCIA * 60 * 1000);
    }

    validar(codigoEscrito, ahora) {
        if (ahora > this.expira) {
            throw new Error('El código venció, pide uno nuevo');
        }
        if (String(codigoEscrito).trim() !== this.codigo) {
            throw new Error('El código no es correcto');
        }
    }
}

CodigoVerificacion.MINUTOS_DE_VIGENCIA = MINUTOS_DE_VIGENCIA;
module.exports = CodigoVerificacion;
