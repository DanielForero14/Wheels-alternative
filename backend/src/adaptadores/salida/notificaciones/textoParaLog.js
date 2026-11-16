// adaptadores/salida/notificaciones/textoParaLog.js
// Los notificadores simulados escriben en la consola (los logs del contenedor) textos que escribe el
// usuario: su nombre, el punto de recogida, el nombre del contacto. Con un salto de línea alguien podría
// "inventar" una línea del log, por ejemplo un código de ingreso o una alerta que nunca ocurrió
// (inyección en logs, hallazgo H-10 de CodeQL). Por eso los saltos de línea y los caracteres de control
// se reemplazan por espacios antes de escribir.
function textoParaLog(valor) {
    return String(valor ?? '')
        .replace(/[\r\n]+/g, ' ')
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, ' ');
}

module.exports = textoParaLog;
