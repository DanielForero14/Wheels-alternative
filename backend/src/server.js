// server.js
// Punto de arranque: arma la aplicación y la pone a escuchar en el puerto 3000.
const path = require('path');
const armarApp = require('./configuracion');

const PORT = process.env.PORT || 3000;
// "npm run start:carga" usa una base de datos en memoria con 500 viajes de ejemplo (pruebas de carga).
const modoCarga = process.argv.includes('--carga');
const rutaBD = modoCarga ? null : path.join(__dirname, '..', 'wheels.db');
// "npm run start:falla-sms" simula que el SMS está caído, para mostrar en la demo
// que la alerta de emergencia se envía por el canal de respaldo.
const simularFallaSMS = process.argv.includes('--falla-sms');
// "npm run start:carga-sin-cache" apaga el caché de rutas para comparar su efecto.
const usarCacheRutas = !process.argv.includes('--sin-cache');

armarApp({ rutaBD, simularFallaSMS, datosDePrueba: modoCarga, usarCacheRutas }).then(app => {
    app.listen(PORT, () => {
        console.log(`Servidor corriendo en http://localhost:${PORT}`);
    });
});
