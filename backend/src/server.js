// server.js
// Punto de arranque: lee la configuración del entorno, arma la aplicación y la pone a escuchar.
// Toda la configuración llega por variables de entorno (ver .env.example); nada sensible está en el código.
const path = require('path');
const armarApp = require('./configuracion');
const { version: versionDelPaquete } = require('../package.json');

const PORT = process.env.PORT || 3000;
// "npm run start:carga" usa una base de datos en memoria con 500 viajes de ejemplo (pruebas de carga).
const modoCarga = process.argv.includes('--carga');
// RUTA_BD permite guardar la base de datos en otra carpeta (en Docker, un volumen).
const rutaBD = modoCarga ? null : (process.env.RUTA_BD || path.join(__dirname, '..', 'wheels.db'));
// "npm run start:falla-sms" simula que el SMS está caído, para mostrar en la demo
// que la alerta de emergencia se envía por el canal de respaldo.
const simularFallaSMS = process.argv.includes('--falla-sms');
// "npm run start:carga-sin-cache" apaga el caché de rutas para comparar su efecto.
const usarCacheRutas = !process.argv.includes('--sin-cache');
// Clave para firmar los tokens de sesión. Sin ella se genera una al azar (las sesiones se pierden al reiniciar).
const secretoToken = process.env.SECRETO_TOKEN || undefined;
if (!secretoToken) {
    console.warn('[AVISO] SECRETO_TOKEN no está definido: se usa una clave temporal. Defínalo en producción.');
}
// VERSION_APP la pone el pipeline al construir la imagen (por ejemplo 3.0.0 o el SHA del commit).
const version = process.env.VERSION_APP || versionDelPaquete;

armarApp({ rutaBD, simularFallaSMS, datosDePrueba: modoCarga, usarCacheRutas, secretoToken, version })
    .then(app => {
        app.listen(PORT, () => {
            console.log(`Servidor WHEELS ${version} corriendo en http://localhost:${PORT}`);
        });
    })
    .catch(error => {
        console.error(`No se pudo iniciar el servidor: ${error.message}`);
        process.exit(1);
    });
