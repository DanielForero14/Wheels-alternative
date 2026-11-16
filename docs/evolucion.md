# Evolución de WHEELS en los tres cortes

WHEELS organiza los viajes compartidos entre estudiantes de La Sabana. Este documento cuenta cómo pasó de un diseño de clases (Corte 1) a una arquitectura justificada y probada (Corte 2) y a un sistema que se entrega de forma continua y segura (Corte 3): qué decisiones se mantuvieron, cuáles cambiaron y por qué, cómo se resolvieron los pendientes del Corte 2 y qué límites tiene el sistema final.

## 1. Resumen de los tres cortes

| | Corte 1 – Diseño | Corte 2 – Arquitectura y pruebas | Corte 3 – Entrega continua y segura |
|---|---|---|---|
| **Pregunta** | ¿Qué clases resuelven el problema? | ¿Qué estilo atiende los retos y cómo se demuestra? | ¿Cómo se garantiza que cada cambio conserva lo anterior y no introduce vulnerabilidades? |
| **Backend** | Express; `server.js` con rutas, armado y arranque; datos en memoria | Arquitectura hexagonal: dominio, aplicación, puertos y adaptadores; SQLite | La misma arquitectura, más autenticación por token, autorización en los casos de uso y `/salud` |
| **Patrones / estilo** | SOLID, Factory Method (`ViajeFactory`), Observer (`INotificador`) | Hexagonal (ADR-001); el Observer pasó a ser el puerto `INotificador` | Hexagonal verificada en cada cambio con funciones de aptitud (dependency-cruiser) |
| **Pruebas** | Ninguna automatizada | 148 pruebas unitarias y de integración; carga con k6 y SLO (p95 ≤ 500 ms, errores < 1 %) | 182 pruebas en el pipeline, umbral de cobertura del dominio, SLO medido contra el entorno desplegado |
| **Seguridad** | Ninguna (cualquiera reserva) | Correo institucional + código; QR de un solo uso | Modelo STRIDE, token firmado, autorización, bloqueo de intentos, 4 controles en el pipeline |
| **Ejecución** | `npm start` en un computador | `npm start` en un computador | Imagen en GHCR, Docker Compose y despliegue automático con prueba de humo y reversión |
| **Documentos** | `corte1.md`, UML | `arquitectura.md`, ADR-001, C4, `pruebas.md` | `devops.md`, `seguridad.md`, ADR-002, ADR-003, vista de despliegue, `implementacion.md`, este documento |

## 2. Corte 1 – Diseño de clases

El problema: estudiantes que viajan a la universidad desde Chía, Cajicá, Zipaquirá, Cota y Suba y comparten carro sin una forma organizada de hacerlo. Se construyó un backend Express con cuatro operaciones (crear viaje, listar, reservar cupo, cancelar) y una app en Expo.

Decisiones de diseño: principios SOLID, **Factory Method** (`ViajeFactory` crea y valida los viajes) y **Observer** (`GestorViajes` avisa a los `INotificador` cuando un viaje cambia).

Límites reconocidos: datos en memoria, sin autenticación y sin pruebas automatizadas.

## 3. Corte 2 – Arquitectura y pruebas

El profesor asignó tres retos: **autenticación con QR** (seguridad), **contacto de emergencia** (disponibilidad) y **planeación de viajes** con tiempo estimado (rendimiento). Se compararon capas, hexagonal y microservicios, y se eligió **hexagonal** (18 contra 14 y 14 puntos; [ADR-001](adr/ADR-001-arquitectura-hexagonal.md)) porque aísla las reglas del negocio de la base de datos, del QR, de los canales y del servicio de mapas, y permite probar el núcleo sin infraestructura.

Resultados: 148 pruebas, 97 % de cobertura; con el servicio de mapas lento el caché bajó el p95 de 640 ms (no cumple) a 17 ms (cumple); el botón de pánico aguantó un pico de 100 usuarios con p95 de 7 ms.

## 4. Corte 3 – Entrega continua y segura

No se agregaron funcionalidades de negocio. El trabajo fue:

- **Contenerizar** el backend (Dockerfile multi-etapa, usuario sin privilegios, solo lectura, healthcheck) y levantarlo con un solo comando.
- **Integración continua** en GitHub Actions: construcción, reglas de arquitectura, pruebas unitarias con umbral de cobertura del dominio, pruebas de integración, app móvil y cuatro controles de seguridad, con un check por etapa ([devops.md](devops.md)).
- **Seguridad**: modelo de amenazas STRIDE con 13 amenazas sobre componentes de WHEELS, controles como quality gates y registro de hallazgos ([seguridad.md](seguridad.md), [ADR-003](adr/ADR-003-seguridad-del-pipeline.md)).
- **Despliegue continuo** en un runner autohospedado con prueba de humo, SLO y reversión ([ADR-002](adr/ADR-002-estrategia-de-despliegue.md), [vista de despliegue](diagramas/c4-despliegue.md)).
- **Guía de implementación** para el equipo técnico de la universidad ([implementacion.md](implementacion.md)).

## 5. Qué decisiones se mantuvieron y cuáles cambiaron

| Decisión | Estado en el Corte 3 | Por qué |
|---|---|---|
| Arquitectura hexagonal (ADR-001) | **Se mantuvo** y ahora se verifica en cada cambio | Fue la que permitió agregar autenticación y autorización sin tocar los adaptadores de salida: el token vive en el adaptador HTTP y las reglas en los casos de uso. Las reglas de dependencias pasaron de ser una convención a ser una prueba del pipeline |
| Puertos `INotificador`, `IRepositorioViajes`, `IServicioRutas`, `IGeneradorCodigo` | **Se mantuvieron** | Ningún cambio del Corte 3 obligó a tocarlos; los límites que quedan (BD, mensajería real) se resuelven con adaptadores nuevos |
| SQLite con sql.js | **Se mantuvo**, ahora en un volumen de Docker | Es suficiente para el volumen de una universidad y no exige un servidor de BD; condicionó el despliegue (ADR-002): se descartaron los planes gratuitos en la nube porque su disco no persiste |
| "El backend confía en el correo que envía la app" | **Cambió**: token de sesión firmado | Era el pendiente principal del Corte 2 y la amenaza A2 del modelo STRIDE |
| Reglas de autorización implícitas | **Cambió**: `ErrorDeAutorizacion` en el dominio y 403 en la API | El modelo de amenazas encontró que cualquiera podía cancelar viajes ajenos o validar QR ajenos (H-06) |
| Código de ingreso sin límite de intentos | **Cambió**: bloqueo al quinto intento | Amenaza A1: se podía adivinar por fuerza bruta (H-07) |
| Ejecución con `npm start` en un computador | **Cambió**: imagen en GHCR y despliegue automático | Objetivo del Corte 3 |
| SLO p95 ≤ 500 ms y errores < 1 % | **Se mantuvo** y ahora es umbral del pipeline | Se mide contra el entorno desplegado en cada despliegue |
| Versión de la API | **Cambió** a 3.0.0 (mayor) | Exigir el token es incompatible con la app del Corte 2 |

## 6. Pendientes del Corte 2 y cómo se resolvieron

Los pendientes salen de la sección 7 de `arquitectura.md` y de la sección de cobertura de `pruebas.md` del Corte 2.

| Pendiente del Corte 2 | Cómo se resolvió en el Corte 3 | Evidencia |
|---|---|---|
| "El backend no usa tokens de sesión: confía en el correo que envía la app. Agregar tokens (por ejemplo JWT) sería el siguiente paso" | **Resuelto.** `/auth/verificar` entrega un token HMAC-SHA256 (equivalente a un JWT HS256, sin dependencias nuevas). Todas las rutas protegidas lo exigen y el usuario sale del token | `tests/unitarias/tokens.test.js`, *Integracion - Seguridad* en `api.test.js`; commit [3e90df5](https://github.com/DanielForero14/Wheels-alternative/commit/3e90df597f79f09d5fd17a8b2e97d7f9829a2cc8) |
| "Para el Corte 3: automatizar estas pruebas en un pipeline de CI/CD" | **Resuelto.** `ci.yml` y `cd.yml` | Pestaña *Actions*; [devops.md](devops.md) |
| `Reserva.js`: faltaban crear una reserva con un estado inexistente y aceptar una solicitud ya respondida | **Resuelto.** Pruebas nuevas; `Reserva.js` con 100 % de líneas | `tests/unitarias/dominio.test.js` |
| `ServicioReservas.js` y `ServicioEmergencia.js`: faltaba el caso de un viaje o solicitud que no existe | **Resuelto.** Pruebas nuevas; los dos con 100 % de líneas | `tests/unitarias/servicios.test.js` |
| "SQLite guarda todo el archivo en cada escritura; si el sistema creciera, PostgreSQL" | **Se mantiene como límite** (sección 7). La BD ahora vive en un volumen de Docker y tiene procedimiento de copia de seguridad ([implementacion.md](implementacion.md)) | ADR-002 |
| Correo y mensajería simulados en consola | **Se mantiene como límite.** Se agregó la limpieza de los textos que se escriben en el log (H-10) | `notificadores.test.js` |
| "Sin tolerancia a caídas del servidor" | **Mitigado parcialmente:** `restart: unless-stopped`, healthcheck y reversión automática; sigue habiendo una sola instancia | ADR-002 |
| Propuestas del Corte 2: ubicación del conductor en tiempo real, autocompletar direcciones, SMS real | **No se implementaron**: el enunciado del Corte 3 no pide funcionalidades de negocio nuevas. Siguen como trabajo futuro | — |

> **Retroalimentación del profesor sobre el Corte 2:** *(el equipo agrega aquí los comentarios recibidos y cómo se atendió cada uno).*

## 7. Límites conocidos del sistema final

- **Una sola instancia y SQLite:** si la máquina o el contenedor se caen, se cae todo, incluidas las alertas de emergencia. Escalar a varias instancias exige una base de datos de servidor (adaptador nuevo de `IRepositorioViajes`) y un balanceador.
- **Entorno en una máquina del equipo:** depende de que esté encendida; la URL es local (`http://localhost:8091` o la IP de la red). No hay HTTPS (ADR-002).
- **Mensajería simulada:** el código de ingreso, los avisos y las alertas se escriben en la consola. Para producción hace falta un adaptador de correo y uno de SMS reales (ver `implementacion.md`).
- **Riesgos de seguridad aceptados:** dependencias de la app móvil que solo se corrigen migrando de versión de Expo (H-02, H-03), sin bitácora de auditoría (H-08) y sin límite de peticiones por cliente (H-09). El token dura 12 horas y no se puede revocar antes, salvo cambiando `SECRETO_TOKEN`.
- **OpenStreetMap público:** limita las peticiones (1 por segundo); el caché lo amortigua, pero para producción hace falta un servidor propio o un proveedor pago.
- **El SLO solo mide la búsqueda** en el pipeline. El tiempo estimado se midió en el Corte 2 con un servicio simulado, porque medirlo en producción golpearía los servidores públicos de OpenStreetMap.
- **La app móvil** se distribuye con Expo Go en modo desarrollo; no hay compilación para las tiendas.

## 8. Lo que haríamos distinto

- Escribir el modelo de amenazas **en el Corte 2**, junto con el ADR: la falta de autenticación real y de autorización se habría visto antes de construir las pantallas.
- Montar el pipeline de CI desde el primer corte: las 148 pruebas del Corte 2 se corrían a mano y nada impedía romperlas.
- Elegir desde el inicio una base de datos que se pueda desplegar en la nube, o aislarla antes detrás de su puerto, para tener más opciones de despliegue.
- Mantener la app móvil al día con las versiones de Expo para no acumular vulnerabilidades que solo se corrigen con una migración mayor.
