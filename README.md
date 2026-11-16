# WHEELS – Transporte Universitario

[![CD (main)](https://github.com/DanielForero14/Wheels-alternative/actions/workflows/cd.yml/badge.svg?branch=main)](https://github.com/DanielForero14/Wheels-alternative/actions/workflows/cd.yml)
[![CI (ramas y PR)](https://github.com/DanielForero14/Wheels-alternative/actions/workflows/ci.yml/badge.svg)](https://github.com/DanielForero14/Wheels-alternative/actions/workflows/ci.yml)

WHEELS organiza los viajes compartidos entre estudiantes de La Sabana: se ingresa con el correo institucional, los conductores programan sus viajes y los pasajeros los buscan, reservan un cupo y abordan mostrando un código QR. Si algo pasa, el botón de pánico avisa al contacto de emergencia.

- **Corte 2:** el sistema respondió a tres retos (**autenticación con QR**, **contacto de emergencia** y **planeación de viajes**) con una **arquitectura hexagonal** y pruebas unitarias, de integración y de carga.
- **Corte 3:** cada cambio pasa por un pipeline que construye, prueba, verifica la arquitectura y la seguridad, y despliega sin pasos manuales; si una verificación falla, el cambio no llega a `main`.

**Sistema desplegado:** `http://localhost:8091` en la máquina del equipo (runner autohospedado; desde la red local, `http://<IP-de-la-máquina>:8091`). Salud: [`/salud`](http://localhost:8091/salud). La evidencia del despliegue es la ejecución del job *Desplegar y verificar* en [Actions → CD](https://github.com/DanielForero14/Wheels-alternative/actions/workflows/cd.yml) (ver [ADR-002](docs/adr/ADR-002-estrategia-de-despliegue.md)).

**Documentación**

| Documento | Contenido |
|---|---|
| [docs/arquitectura.md](docs/arquitectura.md) | Retos, comparación de estilos, diagramas C4 y límites |
| [docs/diagramas/c4-despliegue.md](docs/diagramas/c4-despliegue.md) | Vista de despliegue: dónde corre cada contenedor |
| [docs/devops.md](docs/devops.md) | Pipeline, etapas, umbrales y por qué, versionado y reversión |
| [docs/seguridad.md](docs/seguridad.md) | Modelo de amenazas STRIDE, controles, registro de hallazgos y PR bloqueados |
| [docs/pruebas.md](docs/pruebas.md) | Estrategia y resultados de las pruebas |
| [docs/evolucion.md](docs/evolucion.md) | Los tres cortes, decisiones, pendientes del Corte 2 y límites del sistema final |
| [docs/implementacion.md](docs/implementacion.md) | Guía paso a paso para que la universidad instale y opere el sistema |
| [ADR-001](docs/adr/ADR-001-arquitectura-hexagonal.md) · [ADR-002](docs/adr/ADR-002-estrategia-de-despliegue.md) · [ADR-003](docs/adr/ADR-003-seguridad-del-pipeline.md) | Arquitectura hexagonal · estrategia de despliegue · seguridad del pipeline |
| [CHANGELOG.md](CHANGELOG.md) | Versiones (versionado semántico) |
| [docs/corte1.md](docs/corte1.md) | Entrega del Corte 1 (se conserva como referencia) |

---

## 1. Cómo levantar el sistema con Docker Compose

**Requisitos:** Docker con el plugin de Compose (Docker Desktop en Windows o macOS). No hace falta instalar Node.

```bash
cp .env.example .env
```

Abra `.env` y reemplace `SECRETO_TOKEN` por una clave propia (al menos 32 caracteres), por ejemplo la que imprime:

```bash
openssl rand -hex 32
```

```bash
docker compose up -d --build --wait
```

Resultado esperado: `Container wheels-backend-1 Healthy`. La API queda en `http://localhost:3000` (puerto `PUERTO_BACKEND` del `.env`):

```bash
curl http://localhost:3000/salud
```

Responde `{"estado":"ok","version":"desarrollo"}`. Los datos se guardan en el volumen `datos-wheels`: sobreviven a `docker compose down` y se borran con `docker compose down -v`.

**El código de ingreso** se "envía" por consola (correo simulado). Para leerlo:

```bash
docker compose logs backend | grep "EMAIL a"
```

### Sin Docker (desarrollo)

Requiere Node.js 22.8 o superior.

```bash
cd backend && npm ci && npm start
```

Otras formas de arrancar el backend:

| Comando | Para qué sirve |
|---|---|
| `npm run start:falla-sms` | Simula que el SMS está caído, para mostrar que la alerta de emergencia usa el canal de respaldo |
| `npm run start:carga` | Base de datos en memoria con 500 viajes de ejemplo y un servicio de mapas simulado que tarda 300 ms (pruebas de carga) |
| `npm run start:carga-sin-cache` | Igual que el anterior, pero sin caché de rutas (para comparar) |

### App móvil

Con el backend encendido, en otra terminal:

```bash
cd mobile && npm ci && npx expo start
```

- Presione `w` para abrirla en el navegador, o escanee el QR con **Expo Go** en el celular (el celular y el computador en la misma red wifi).
- Por defecto la app busca la API en el puerto 3000 del computador que la sirve. Para usar otra dirección (por ejemplo el despliegue en el puerto 8091), arránquela con `EXPO_PUBLIC_API_URL=http://<IP>:8091 npx expo start`.

| Pantalla | Rol | Qué hace |
|---|---|---|
| Ingreso | Todos | Correo institucional, rol y código de verificación |
| Viajes | Pasajero | Buscar por día, origen y destino; ver el nombre del conductor y por dónde pasa; **¿Cuánto me demoro?** desde su ubicación con **Ver en el mapa**; **solicitar cupo** indicando dónde lo recogen |
| Mis reservas | Pasajero | Estado de cada solicitud. Cuando el conductor acepta: el código QR y **Tu wheels** (placa, descripción del carro y nombre del conductor) |
| Mis viajes | Conductor | **Mi vehículo** (obligatorio antes de programar), programar viajes, ver y cancelar los suyos |
| Solicitudes | Conductor | Ver quién pide cupo y dónde lo recogen; aceptar o rechazar |
| Validar QR | Conductor | Escanear el QR del pasajero o escribir el código |
| Emergencia | Todos | Contacto de emergencia, botón de pánico (mantener 3 s) que envía la ubicación, y llamar al contacto |

### Endpoints de la API

**Autenticación:** `POST /auth/verificar` devuelve un `token`. Todas las rutas, salvo `/`, `/salud` y `/auth/*`, exigen `Authorization: Bearer <token>` (401 si falta o no es válido). El usuario que actúa sale siempre del token. Las rutas `/usuarios/:correo/...` solo las usa el dueño de ese correo, y solo el conductor del viaje puede cancelarlo, responder sus solicitudes o validar el QR (403 en otro caso). El código de ingreso se bloquea tras 5 intentos fallidos.

| Método y ruta | Qué hace | Reto |
|---|---|---|
| `GET /salud` | Estado y versión desplegada (healthcheck; sin token) | – |
| `POST /auth/solicitar-codigo` | Envía un código al correo institucional (`nombre, correo, rol`) | 1 |
| `POST /auth/verificar` | Verifica el código (`correo, codigo`) y devuelve el usuario con su `token` | 1 |
| `POST /viajes` | Programa un viaje (`puntoInicio, puntoFinal, fecha, hora, cuposDisponibles`, `descripcionRuta` opcional) | 3 |
| `GET /viajes?fecha=&origen=&destino=` | Busca viajes disponibles con el nombre del conductor | 3 |
| `GET /viajes/:id/tiempo-estimado?lat=&lon=` | Distancia y minutos desde la ubicación dada hasta el destino del viaje | 3 |
| `GET /usuarios/:correo/viajes` | Viajes que programó el conductor | 3 |
| `GET` · `PUT /usuarios/:correo/vehiculo` | Consulta o registra el vehículo (`placa` tipo ABC123, `descripcion`) | 1 |
| `POST /viajes/:id/cancelar` | Cancela el viaje (solo su conductor) y avisa a los interesados | – |
| `POST /viajes/:id/reservar` | El pasajero solicita un cupo (`puntoRecogida`); queda pendiente | 1 |
| `GET /usuarios/:correo/solicitudes` | Solicitudes que recibió el conductor | 1 |
| `POST /reservas/:id/aceptar` · `/rechazar` | El conductor responde; al aceptar se genera el código y la imagen QR | 1 |
| `GET /usuarios/:correo/reservas` | Reservas del pasajero; la imagen QR y el vehículo solo si fue aceptada | 1 |
| `POST /viajes/:id/abordar` | El conductor del viaje valida el código QR del pasajero (`codigo`) | 1 |
| `GET` · `PUT /usuarios/:correo/contacto-emergencia` | Consulta o registra el contacto de emergencia (`nombre, telefono`) | 2 |
| `POST /emergencias` | Botón de pánico: alerta al contacto (`viajeId` y `ubicacion` opcionales) | 2 |

---

## 2. Cómo se ejecuta el pipeline

El detalle de cada etapa, su umbral y por qué se eligió está en [docs/devops.md](docs/devops.md).

- **CI** ([`ci.yml`](.github/workflows/ci.yml)) corre en cada push a una rama y en cada Pull Request hacia `main`. Cada etapa es un check del PR: construcción, reglas de arquitectura, pruebas unitarias con cobertura del dominio ≥ 80 %, pruebas de integración, app móvil, SAST (CodeQL), SCA (Trivy), secretos (Gitleaks) e imagen (Trivy). `main` está protegida: sin todos los checks en verde y la aprobación de otro integrante no se puede fusionar.
- **CD** ([`cd.yml`](.github/workflows/cd.yml)) corre en cada push a `main` y en cada tag `vX.Y.Z`: repite el CI, publica la imagen en GHCR (`sha-<commit>` y la versión), la despliega en el runner autohospedado, ejecuta la prueba de humo y el SLO con k6, y revierte a la versión anterior si algo falla.
- **Reversión manual:** *Actions → CD → Run workflow* con el tag de la imagen (`sha-<commit>` o `3.0.0`).
- **Prueba de carga larga:** *Actions → Prueba de carga larga → Run workflow* ([`carga-larga.yml`](.github/workflows/carga-larga.yml)).
- **Para publicar una versión:** crear el tag en `main` (`git tag -a v3.0.1 -m "..."` y `git push origin v3.0.1`) y agregar su entrada en `CHANGELOG.md`.

Las mismas verificaciones se pueden correr a mano: en `backend/`, `npm run construir`, `npm run arquitectura`, `npm run test:unitarias` y `npm run test:integracion`; en la raíz (con Docker), `scripts/sca.sh`, `scripts/secretos.sh` y `scripts/escaneo-imagen.sh <imagen>`.

**Pruebas de carga del Corte 2 (k6, a mano).** La API exige token, así que k6 firma el suyo con la **misma** `SECRETO_TOKEN` de la API:

```bash
export SECRETO_TOKEN=$(openssl rand -hex 32)
```
```bash
cd backend && npm run start:carga
```

En otra terminal, con la misma `SECRETO_TOKEN`, desde la raíz:

```bash
k6 run -e SECRETO_TOKEN=$SECRETO_TOKEN perf/scripts/busqueda-carga.js
```

Los demás scripts (`busqueda-baseline.js`, `emergencia-pico.js` y `tiempo-estimado.js` con `start:carga` o `start:carga-sin-cache`) se ejecutan igual. Resultados en [docs/pruebas.md](docs/pruebas.md).

---

## 3. Estructura del repositorio

```
.github/
├── workflows/              ← ci.yml, cd.yml, carga-larga.yml
├── codeql/                 ← excepciones del quality gate de SAST
└── dependabot.yml
backend/
├── Dockerfile              ← multi-etapa, node:24.22.2-bookworm-slim, usuario node, HEALTHCHECK
├── .dependency-cruiser.cjs ← reglas de la arquitectura hexagonal (funciones de aptitud)
├── src/
│   ├── dominio/            ← Usuario, CodigoVerificacion, Vehiculo, Viaje, Reserva, ContactoEmergencia, ViajeFactory, ErrorDeAutorizacion
│   ├── aplicacion/         ← casos de uso: ServicioUsuarios, ServicioViajes, ServicioReservas, ServicioEmergencia, ServicioTiempoEstimado
│   ├── puertos/            ← IRepositorioViajes, IGeneradorCodigo, INotificador, IServicioRutas
│   ├── adaptadores/
│   │   ├── entrada/http/   ← crearApp.js (rutas de Express) y tokens.js (token de sesión)
│   │   └── salida/         ← persistencia (SQLite, memoria), qr, notificaciones, rutas (mapas)
│   ├── configuracion.js    ← conecta cada puerto con su adaptador
│   └── server.js           ← lee la configuración del entorno y arranca
└── tests/
    ├── unitarias/          ← dominio, casos de uso y token, con dobles de prueba
    └── integracion/        ← adaptadores reales, notificadores y la API por HTTP
scripts/                    ← controles de seguridad, deploy, smoke-test, slo y rollback (los usa el pipeline)
perf/
├── slo.js                  ← prueba corta del SLO que corre después de cada despliegue
├── scripts/                ← pruebas de carga del Corte 2
└── resultados/
docs/                       ← arquitectura, ADR, diagramas, pruebas, devops, seguridad, evolución e implementación
mobile/                     ← app Expo / React Native (servicios/api.ts es el único archivo que habla con la API)
docker-compose.yml          ← backend (+ k6 en el perfil "pruebas")
.env.example                ← variables necesarias, sin valores reales
```

**Regla de dependencias:** `dominio/` y `aplicacion/` nunca importan Express, SQLite ni la librería de QR; solo conocen los `puertos/`. El pipeline lo comprueba en cada cambio.

---

## 4. Tabla de trazabilidad ampliada

Es la tabla del Corte 2 con dos columnas nuevas: la **etapa del pipeline** que vuelve a verificar cada reto en cada cambio y el **umbral** que detiene el pipeline.

| Reto (Corte 2) | Atributo de calidad | Decisión arquitectónica | Prueba que lo evidencia | Etapa del pipeline | Umbral que detiene el pipeline |
|---|---|---|---|---|---|
| **Autenticación QR:** solo estudiantes de La Sabana ingresan y solo aborda el pasajero que el conductor aceptó; los códigos no se adivinan ni se reutilizan | Seguridad | Correo `@unisabana.edu.co` + código de 6 dígitos (vence, un solo uso, **bloqueo a los 5 intentos**); **token de sesión firmado** y autorización en los casos de uso; QR generado solo al aceptar, de un solo uso y ligado al viaje (`Reserva`, `ServicioReservas`, puerto `IGeneradorCodigo`) | Unitarias: `CodigoVerificacion`, `Reserva`, `ServicioReservas`, `tokens.test.js`. Integración: flujo solicitar → aceptar → abordar → reutilizar QR; *Integracion - Seguridad* (401, 403, suplantación, fuerza bruta) | pruebas → **unitarias** e **integración**; despliegue → **prueba de humo** (flujo QR completo, 401 y 403 en producción) | Falla una prueba; o en producción el QR no se valida, la API responde sin token o deja cancelar un viaje ajeno |
| **Autenticación QR** (lado del pipeline): que un cambio no introduzca vulnerabilidades ni secretos | Seguridad | Controles DevSecOps como quality gates (ADR-003) | CodeQL, Trivy, Gitleaks; PR bloqueados [#4](https://github.com/DanielForero14/Wheels-alternative/pull/4) y [#5](https://github.com/DanielForero14/Wheels-alternative/pull/5) | **SAST**, **SCA**, **secretos**, **imagen** | SAST: hallazgo ≥ 7.0 sin tratar · SCA: HIGH/CRITICAL con corrección · secretos: ≥ 1 · imagen: CRITICAL con corrección |
| **Contacto de emergencia:** la alerta llega aunque falle un canal | Disponibilidad / extensibilidad | Puerto `INotificador` con adaptadores intercambiables; `ServicioEmergencia` prueba los canales en orden (SMS y luego correo) | Unitarias con un canal que falla; integración con el SMS caído (`simularFallaSMS`) | pruebas → **unitarias** e **integración** | Falla una prueba |
| **Contacto de emergencia:** el botón de pánico aguanta un pico de alertas | Disponibilidad / rendimiento | Servicio sin estado, canales en memoria | `perf/scripts/emergencia-pico.js` (100 usuarios: p95 = 7 ms, 0 % errores en el Corte 2) | **Sin verificación automática en el pipeline:** el pico envía ~4.000 alertas y crea 100 contactos; correrlo en cada despliegue llenaría la base de datos de producción. Se ejecuta a mano con `start:carga` | — |
| **Planeación de viajes:** buscar viajes rápido con muchos estudiantes a la vez | Rendimiento | Búsqueda indexada en SQLite (`idx_viajes_busqueda`), servicio sin estado | `perf/slo.js` (k6, 20 búsquedas/s durante 30 s contra el entorno desplegado); prueba larga `carga-larga.yml` | despliegue → **prueba de carga del SLO** | **p95 > 500 ms** o **errores ≥ 1 %** |
| **Planeación de viajes:** tiempo estimado rápido y aunque falle el servicio de mapas | Rendimiento / disponibilidad | Puerto `IServicioRutas` con OpenStreetMap y respaldo `RutasEstimadas`; caché de rutas (5 min) en `ServicioTiempoEstimado` | Unitarias: caché (acierto, vencido, simultáneas), respaldo. Integración: servicio de mapas caído. Carga del Corte 2: sin caché p95 = 640 ms, con caché 17 ms | pruebas → **unitarias** e **integración** | Falla una prueba. La carga con el servicio simulado lento es **manual**: en producción golpearía los servidores públicos de OpenStreetMap (1 petición/s) |
| **Los tres retos:** cambiar la BD, el QR, el canal o el proveedor de mapas sin tocar el negocio | Mantenibilidad / modificabilidad | Arquitectura hexagonal (ADR-001): dominio y casos de uso solo conocen puertos; solo `configuracion.js` conecta adaptadores | `backend/.dependency-cruiser.cjs` (7 reglas, dependency-cruiser) | pruebas → **reglas de arquitectura** | Una clase del dominio o de la aplicación importa un adaptador, una librería o un módulo de infraestructura; o cualquier archivo distinto de `configuracion.js` importa un adaptador de salida |
| **Usabilidad de la app** (ingresar, reservar y abordar sin capacitación) | Usabilidad | Pantallas por rol, QR con la cámara, "¿Cuánto me demoro?" con el GPS | Recorrido manual en el celular (sección 5) | **Sin verificación automática:** requiere un celular con cámara y GPS y una evaluación con usuarios. El pipeline solo garantiza que la app compila (tipos y lint) | — |

---

## 5. Revisión manual de la app antes de una entrega

1. `docker compose up -d --build --wait` (o el backend con `npm start`) y `npx expo start` en `mobile/`.
2. Ingresar como **conductor** (correo @unisabana.edu.co + código de los logs), registrar **Mi vehículo** y programar un viaje para mañana.
3. Ingresar como **pasajero** con otro correo, buscar el viaje, pulsar **¿Cuánto me demoro?** (aceptar el permiso de ubicación) y **Solicitar cupo**.
4. Como conductor, **Aceptar** en Solicitudes; como pasajero, ver el QR y **Tu wheels** en Mis reservas.
5. Como conductor, en **Validar QR**, escanear el QR (celular) o pegar el código: "Abordaje confirmado"; la segunda vez, "ya fue usado".
6. En **Emergencia**, guardar un contacto y mantener el botón SOS 3 segundos: "Alerta enviada ... por SMS".

---

## 6. Equipo

| Integrante | Rol / contribución |
|---|---|
| Gabriel Armando González Sosa | Diseño UML y desarrollo de la app móvil (Expo/React Native) |
| Laura Sofía Rodriguez Gonzalez | Implementación del backend (Express), patrones de diseño y principios SOLID |
| Daniel Felipe Forero Sánchez | Documentación |
