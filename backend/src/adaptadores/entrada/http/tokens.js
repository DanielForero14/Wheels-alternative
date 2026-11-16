// adaptadores/entrada/http/tokens.js
// Token de sesión que se entrega al verificar el correo (pendiente del Corte 2: "el backend no usa tokens").
// Formato: <datos>.<firma>
//   datos = base64url de {"correo", "rol", "exp"}
//   firma = HMAC-SHA256(datos) con SECRETO_TOKEN, en base64url
// Es la misma idea de un JWT con HS256, escrita con node:crypto para no agregar dependencias.
// Vive en el adaptador de entrada porque es un detalle del transporte HTTP: el núcleo solo recibe el correo.
const crypto = require('crypto');

const DOCE_HORAS = 12 * 60 * 60 * 1000;

function crearEmisorTokens(secreto, duracionMs = DOCE_HORAS) {
    if (!secreto || secreto.length < 32) {
        throw new Error('SECRETO_TOKEN debe tener al menos 32 caracteres');
    }

    const firmar = (datos) => crypto.createHmac('sha256', secreto).update(datos).digest('base64url');

    return {
        emitir(usuario, ahora = Date.now()) {
            const contenido = { correo: usuario.correo, rol: usuario.rol, exp: ahora + duracionMs };
            const datos = Buffer.from(JSON.stringify(contenido)).toString('base64url');
            return `${datos}.${firmar(datos)}`;
        },

        // Devuelve { correo, rol } o null si el token falta, está alterado o venció.
        verificar(token, ahora = Date.now()) {
            const [datos, firma, sobrante] = String(token || '').split('.');
            if (!datos || !firma || sobrante !== undefined) {
                return null;
            }
            const esperada = Buffer.from(firmar(datos));
            const recibida = Buffer.from(firma);
            // Comparación en tiempo constante: no deja adivinar la firma midiendo tiempos.
            if (esperada.length !== recibida.length || !crypto.timingSafeEqual(esperada, recibida)) {
                return null;
            }
            try {
                const { correo, rol, exp } = JSON.parse(Buffer.from(datos, 'base64url').toString());
                return typeof exp === 'number' && ahora <= exp ? { correo, rol } : null;
            } catch {
                return null;
            }
        },
    };
}

module.exports = { crearEmisorTokens };
