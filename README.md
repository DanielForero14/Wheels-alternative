# WHEELS – Transporte Universitario (Corte 2)

WHEELS organiza los viajes compartidos entre estudiantes de La Sabana: se ingresa con el correo institucional, los conductores programan sus viajes y los pasajeros los buscan, reservan un cupo y abordan mostrando un código QR. Si algo pasa, el botón de pánico avisa al contacto de emergencia. En este corte el sistema evolucionó para responder a tres retos: **autenticación con QR**, **contacto de emergencia** y **planeación de viajes**. Para eso reorganizamos el backend con **arquitectura hexagonal (puertos y adaptadores)** y construimos pruebas unitarias, de integración y de carga.

**Documentación:**
- [Documento de arquitectura](docs/arquitectura.md): retos, comparación de estilos, diagramas y límites conocidos.
- [ADR-001: arquitectura hexagonal](docs/adr/ADR-001-arquitectura-hexagonal.md)
- [Diagramas](docs/diagramas/): contexto, contenedores y componentes (C4) y arquitectura inicial del Corte 1.
- [Estrategia y resultados de pruebas](docs/pruebas.md)
- [Entrega del Corte 1](docs/corte1.md) (se conserva como referencia)

---

## 1. Cómo ejecutar el sistema

**Requisitos:** Node.js 20 o superior. Para las pruebas de carga, además, [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/) (en Windows: `winget install k6 --source winget`).

### Backend

```bash
cd backend
npm install
npm start
```

El servidor queda en `http://localhost:3000` y guarda los datos en el archivo `backend/wheels.db`, así que no se pierden al reiniciar.

Otras formas de arrancar:

| Comando | Para qué sirve |
|---|---|
| `npm run start:falla-sms` | Simula que el SMS está caído, para mostrar que la alerta de emergencia usa el canal de respaldo |
| `npm run start:carga` | Base de datos en memoria con 500 viajes de ejemplo y un servicio de mapas simulado que tarda 300 ms (para las pruebas de carga) |
| `npm run start:carga-sin-cache` | Igual que el anterior, pero sin caché de rutas (para comparar) |

### App móvil

Con el backend encendido, en otra terminal:

```bash
cd mobile
npm install
npx expo start
```

- Presiona `w` para abrirla en el navegador (lo más rápido para revisar).
- O escanea el QR con **Expo Go** en el celular. El celular y el computador deben estar en la misma red wifi. Para escanear el QR del pasajero con la cámara, usa el celular.
- La app encuentra sola la dirección del backend. Si Windows pregunta si permite que Node use la red, acepta.

**Cómo ingresar:** escribe un correo `@unisabana.edu.co` y pulsa "Enviar código". Como el correo es simulado, el código de 6 dígitos aparece en la **terminal del backend**, en una línea como `[EMAIL a ana@unisabana.edu.co] Tu código de ingreso a WHEELS es 482913`.

| Pantalla | Rol | Qué hace |
|---|---|---|
| Ingreso | Todos | Correo institucional, rol y código de verificación |
| Viajes | Pasajero | Buscar por día, origen y destino; ver por dónde pasa; **¿Cuánto me demoro?** desde tu ubicación con botón **Ver en el mapa**; **solicitar cupo** indicando dónde te recogen |
| Mis reservas | Pasajero | Estado de cada solicitud (pendiente, aceptada o rechazada) y el código QR cuando el conductor acepta |
| Mis viajes | Conductor | Programar viajes (con la descripción de por dónde pasa), ver y cancelar los suyos |
| Solicitudes | Conductor | Ver quién pide cupo y dónde lo recogen; aceptar o rechazar |
| Validar QR | Conductor | Escanear el QR del pasajero o escribir el código |
| Emergencia | Todos | Contacto de emergencia, botón de pánico (mantener 3 s) que envía tu ubicación, y llamar al contacto |

### Endpoints de la API

| Método y ruta | Qué hace | Reto |
|---|---|---|
| `POST /auth/solicitar-codigo` | Envía un código al correo institucional (`nombre, correo, rol`) | 1 |
| `POST /auth/verificar` | Verifica el código (`correo, codigo`) y devuelve el usuario | 1 |
| `POST /viajes` | Programa un viaje (`conductorId, puntoInicio, puntoFinal, fecha, hora, cuposDisponibles`, `descripcionRuta` opcional: por dónde pasa) | 3 |
| `GET /viajes?fecha=&origen=&destino=` | Busca viajes disponibles (los filtros son opcionales) | 3 |
| `GET /viajes/:id/tiempo-estimado?lat=&lon=` | Distancia y minutos desde la ubicación dada hasta el destino del viaje | 3 |
| `GET /usuarios/:correo/viajes` | Viajes que programó un conductor | 3 |
| `POST /viajes/:id/cancelar` | Cancela un viaje y avisa a los interesados | – |
| `POST /viajes/:id/reservar` | El pasajero solicita un cupo (`pasajeroId`, `puntoRecogida`); queda pendiente | 1 |
| `GET /usuarios/:correo/solicitudes` | Solicitudes que recibió un conductor en sus viajes | 1 |
| `POST /reservas/:id/aceptar` · `POST /reservas/:id/rechazar` | El conductor (`conductorId`) responde; al aceptar se genera el código y la imagen QR | 1 |
| `GET /usuarios/:correo/reservas` | Reservas del pasajero con su estado; la imagen QR solo si fue aceptada | 1 |
| `POST /viajes/:id/abordar` | El conductor valida el código QR del pasajero (`codigo`) | 1 |
| `GET /usuarios/:correo/contacto-emergencia` | Consulta el contacto de emergencia | 2 |
| `PUT /usuarios/:correo/contacto-emergencia` | Registra el contacto de emergencia (`nombre, telefono`) | 2 |
| `POST /emergencias` | Botón de pánico: alerta al contacto (`usuarioId`; `viajeId` y `ubicacion` opcionales) | 2 |

---

## 2. Cómo ejecutar las pruebas

Todas las pruebas usan el ejecutor de pruebas que ya trae Node (`node:test`), así que no hay que instalar nada adicional.

```bash
cd backend
npm test                   # todas las pruebas (unitarias + integración)
npm run test:unitarias     # solo unitarias
npm run test:integracion   # solo integración
npm run test:cobertura     # todas, con el reporte de cobertura
```

**Pruebas de carga (k6).** En una terminal se arranca la API con datos de ejemplo y en otra se ejecuta el script:

```bash
# Terminal 1
cd backend
npm run start:carga

# Terminal 2 (desde la raíz del repositorio)
k6 run --summary-export perf/resultados/busqueda-baseline.json perf/scripts/busqueda-baseline.js
k6 run --summary-export perf/resultados/busqueda-carga.json    perf/scripts/busqueda-carga.js
k6 run --summary-export perf/resultados/emergencia-pico.json   perf/scripts/emergencia-pico.js
```

**Caché del tiempo estimado (Reto 3).** Se corre el mismo script dos veces, cambiando cómo arranca la API:

```bash
# 1) Sin caché: Terminal 1 -> npm run start:carga-sin-cache
k6 run --summary-export perf/resultados/tiempo-estimado-sin-cache.json perf/scripts/tiempo-estimado.js
# 2) Con caché: Terminal 1 -> npm run start:carga
k6 run --summary-export perf/resultados/tiempo-estimado-con-cache.json perf/scripts/tiempo-estimado.js
```

Reinicia la API (Terminal 1) antes de cada script para que empiece con la base de datos vacía.

---

## 3. Estructura del repositorio

```
backend/
├── src/
│   ├── dominio/            ← Usuario, CodigoVerificacion, Viaje, Reserva, ContactoEmergencia, ViajeFactory
│   ├── aplicacion/         ← casos de uso: ServicioUsuarios, ServicioViajes, ServicioReservas, ServicioEmergencia, ServicioTiempoEstimado
│   ├── puertos/            ← interfaces: IRepositorioViajes, IGeneradorCodigo, INotificador, IServicioRutas
│   ├── adaptadores/
│   │   ├── entrada/http/   ← rutas de Express
│   │   └── salida/         ← persistencia (SQLite, memoria), qr, notificaciones, rutas (mapas)
│   ├── configuracion.js    ← conecta cada puerto con su adaptador
│   ├── datosDePrueba.js    ← 500 viajes de ejemplo para las pruebas de carga
│   └── server.js           ← arranca el servidor
└── tests/
    ├── unitarias/          ← dominio y casos de uso, con dobles de prueba
    └── integracion/        ← adaptadores reales y flujos HTTP de extremo a extremo
perf/
├── scripts/                ← scripts de k6
└── resultados/             ← reportes de las pruebas de carga
docs/                       ← arquitectura, ADR, diagramas y pruebas
mobile/
├── app/                    ← pantallas: ingreso, verificar y las pestañas en app/(tabs)/
├── components/wheels/      ← piezas visuales: botones, campos, tarjetas, tiempo estimado
├── servicios/              ← api.ts (único que habla con el backend), sesión, ubicación y fechas
├── constants/colores.ts    ← paleta blanco y azul del logo
└── assets/images/logo.png  ← logo de WHEELS
```

**Regla de dependencias:** `dominio/` y `aplicacion/` nunca importan Express, SQLite ni la librería de QR. Solo conocen los `puertos/`.

---

## 4. Tabla de trazabilidad

Los tres retos exigen **funcionalidad nueva**, lo cual el enunciado permite cuando el reto lo pide.

| Reto | Atributo de calidad | Decisión arquitectónica | Dónde está | Prueba que lo evidencia | Resultado |
|---|---|---|---|---|---|
| **Autenticación QR:** solo estudiantes de La Sabana ingresan, y solo aborda el pasajero que el conductor aceptó; los códigos no se adivinan ni se reutilizan | Seguridad / mantenibilidad | Ingreso con correo `@unisabana.edu.co` y código de 6 dígitos (Usuario, CodigoVerificacion, ServicioUsuarios). El pasajero solicita el cupo con su punto de recogida y **el QR solo se genera cuando el conductor acepta**. Puerto IGeneradorCodigo con el adaptador GeneradorCodigoQR. La regla "válido, de este viaje, vigente y sin usar" vive en el dominio (Reserva) y en ServicioReservas | `backend/src/dominio/Usuario.js`, `backend/src/dominio/CodigoVerificacion.js`, `backend/src/aplicacion/ServicioUsuarios.js`, `backend/src/dominio/Reserva.js`, `backend/src/aplicacion/ServicioReservas.js`, `backend/src/adaptadores/salida/qr/` | Unitarias: correos válidos e inválidos (incluye `@unisabana.edu.co.falso.com`), código de correo correcto, incorrecto, vencido y reutilizado; solicitud pendiente sin QR, aceptar/rechazar, solo el conductor del viaje responde; QR válido, inventado, de otro viaje, vencido y ya usado. Integración: ingreso completo y solicitar → aceptar → abordar → reutilizar el QR por HTTP | Unitarias e integración: pasan (parte de las 136/136). Probado también a mano en la app: el QR se acepta una vez y la segunda vez se rechaza |
| **Contacto de emergencia:** la alerta llega al contacto aunque falle un canal | Disponibilidad / extensibilidad | Nuevo adaptador EmergenciaNotificador (SMS) sobre el puerto INotificador del Corte 1. ServicioEmergencia prueba los canales en orden: si el SMS falla, usa el correo | `backend/src/aplicacion/ServicioEmergencia.js`, `backend/src/adaptadores/salida/notificaciones/`, `backend/src/configuracion.js` | Unitarias con un canal que falla. Integración con el SMS caído (`simularFallaSMS`). Carga: pico de 100 alertas (`perf/scripts/emergencia-pico.js`) | Unitarias e integración: pasan (parte de las 136/136). Probado a mano: la alerta llega por SMS, y con `start:falla-sms` llega por correo. Carga (pico de 100 usuarios): 4.034 alertas enviadas, p95 = 7.05 ms, 0 % errores → **cumple el SLO** (p95 ≤ 500 ms, errores < 1 %) |
| **Planeación de viajes:** mostrar cuánto se demora el estudiante desde donde está hasta el destino del viaje, rápido y aunque falle el servicio de mapas | Rendimiento / disponibilidad / mantenibilidad | Puerto IServicioRutas con el adaptador RutasOpenStreetMap (direcciones y rutas reales) y el respaldo RutasEstimadas. ServicioTiempoEstimado guarda en **caché** las rutas (5 min) y las direcciones, y cambia al **respaldo** si el servicio externo falla. Los viajes se programan con fecha y se guardan en SQLite | `backend/src/aplicacion/ServicioTiempoEstimado.js`, `backend/src/puertos/IServicioRutas.js`, `backend/src/adaptadores/salida/rutas/`, `mobile/components/wheels/TiempoEstimado.tsx` | Unitarias: caché (acierto, vencido a los 5 min, consultas simultáneas), respaldo, ubicaciones inválidas. Integración: tiempo estimado por HTTP y con el servicio de mapas caído. Carga: `perf/scripts/tiempo-estimado.js` con y sin caché | Unitarias e integración: pasan (parte de las 136/136). Carga con 50 usuarios y servicio de mapas lento: **sin caché p95 = 640 ms → no cumple**; **con caché p95 = 17 ms → cumple el SLO** (p95 ≤ 500 ms, errores 0 %). La búsqueda de viajes también cumple: p95 = 10.16 ms con 200 usuarios |

---

## 5. Revisión antes de subir cambios

1. `cd backend` → `npm install` → `npm test`: todas las pruebas deben pasar.
2. `npm start` en backend y `npx expo start` en mobile.
3. Recorrido completo en la app:
   - Ingresar como **conductor** (correo @unisabana.edu.co + código de la consola) y programar un viaje para mañana, escribiendo por dónde pasa.
   - Salir e ingresar como **pasajero** con otro correo, buscar el viaje (debe verse "Pasa por: ...") y pulsar **¿Cuánto me demoro?** (aceptar el permiso de ubicación): deben salir los minutos y los km, y **Ver en el mapa** abre Google Maps con la ruta. Luego **Solicitar cupo** escribiendo dónde te recogen; en **Mis reservas** aparece "Esperando que el conductor acepte".
   - Volver como conductor, abrir **Solicitudes** y **Aceptar**. Como pasajero, en **Mis reservas** ya aparece el QR.
   - Volver a ingresar como conductor y, en **Validar QR**, escanear el QR (celular) o pegar el código: debe decir "Abordaje confirmado". Validarlo otra vez debe decir que ya fue usado.
   - En **Emergencia**, guardar un contacto y mantener presionado el botón SOS 3 segundos: debe decir "Alerta enviada ... por SMS con tu ubicación" y en la consola del backend aparece la línea `[SMS a ...]` con un link `maps.google.com`.
   - Opcional: arrancar el backend con `npm run start:falla-sms` y repetir la alerta: debe salir "por correo".
4. Si todo funciona, commit y push a la rama `corte2`.

---

## 6. Equipo

| Integrante | Rol / contribución |
|---|---|
| Gabriel Armando González Sosa | Diseño UML y desarrollo de la app móvil (Expo/React Native) |
| Daniel Felipe Forero Sánchez | Implementación del backend (Express), patrones de diseño y principios SOLID |
| Laura Sofía Rodriguez Gonzalez | Documentación |
