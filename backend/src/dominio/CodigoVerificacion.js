// dominio/CodigoVerificacion.js
// Código de 6 dígitos que se envía al correo para confirmar que el estudiante es dueño de ese correo.
// Corte 3 (modelo de amenazas, S-01): con intentos ilimitados un atacante podría probar el millón de
// combinaciones en los 10 minutos de vigencia y suplantar a cualquier estudiante. Por eso el código
// se bloquea después de MAXIMO_INTENTOS fallidos y hay que pedir uno nuevo.
const MINUTOS_DE_VIGENCIA = 10;
const MAXIMO_INTENTOS = 5;

class CodigoVerificacion {
    constructor(correo, codigo, expira, intentosFallidos = 0) {
        this.correo = correo;
        this.codigo = codigo;
        this.expira = expira;                     // momento (en milisegundos) en que el código vence
        this.intentosFallidos = intentosFallidos; // se guarda en el repositorio entre una petición y otra
    }

    static crear(correo, codigo, ahora) {
        return new CodigoVerificacion(correo, codigo, ahora + MINUTOS_DE_VIGENCIA * 60 * 1000);
    }

    // Si el código no es correcto, suma un intento fallido: quien llama debe guardar el código otra vez.
    validar(codigoEscrito, ahora) {
        if (this.intentosFallidos >= MAXIMO_INTENTOS) {
            throw new Error('Demasiados intentos fallidos, pide un código nuevo');
        }
        if (ahora > this.expira) {
            throw new Error('El código venció, pide uno nuevo');
        }
        if (String(codigoEscrito).trim() !== this.codigo) {
            this.intentosFallidos += 1;
            const quedan = MAXIMO_INTENTOS - this.intentosFallidos;
            throw new Error(quedan > 0
                ? `El código no es correcto (te quedan ${quedan} intentos)`
                : 'El código no es correcto y se bloqueó: pide un código nuevo');
        }
    }
}

CodigoVerificacion.MINUTOS_DE_VIGENCIA = MINUTOS_DE_VIGENCIA;
CodigoVerificacion.MAXIMO_INTENTOS = MAXIMO_INTENTOS;
module.exports = CodigoVerificacion;
