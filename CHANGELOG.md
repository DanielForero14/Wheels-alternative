# Registro de cambios

Este proyecto usa [versionado semántico](https://semver.org/lang/es/): `MAYOR.MENOR.PARCHE`.
Cada versión se marca con un tag `vX.Y.Z` en `main`; el pipeline de CD publica la imagen
`ghcr.io/danielforero14/wheels-backend` con la etiqueta `X.Y.Z` (además de `sha-<commit>`) y la despliega.

## [3.0.0] – Corte 3: entrega continua y segura

### Agregado
- Pipeline de integración continua (`ci.yml`): construcción, reglas de arquitectura (dependency-cruiser),
  pruebas unitarias con umbral de cobertura del dominio (≥ 80 %), pruebas de integración, app móvil
  (tipos y lint) y cuatro controles de seguridad como quality gates (CodeQL, Trivy fs, Gitleaks, Trivy imagen).
- Pipeline de despliegue continuo (`cd.yml`): imagen en GHCR con el SHA y la versión, despliegue con
  Docker Compose en un runner autohospedado, prueba de humo, prueba de carga del SLO con k6 y
  reversión automática y manual. Prueba de carga larga a mano (`carga-larga.yml`).
- Autenticación con token de sesión firmado (HMAC-SHA256) y autorización por usuario en la API.
- Bloqueo del código de ingreso tras 5 intentos fallidos.
- Endpoint `GET /salud` con la versión desplegada.
- Modelo de amenazas STRIDE, registro de hallazgos y ADR de despliegue y de seguridad.

### Cambiado
- **Incompatible con la versión 2:** todas las rutas, salvo `/`, `/salud` y `/auth/*`, exigen
  `Authorization: Bearer <token>`; el usuario sale del token y no del cuerpo de la petición.
- Solo el conductor del viaje puede cancelarlo o validar el QR (403 en otro caso).
- La imagen corre con sistema de archivos de solo lectura y sin capacidades de Linux.

### Corregido
- Dependencias vulnerables del backend (`proxy-addr`, `body-parser`, `qs`) y de la app móvil.
- Inyección en los logs de los notificadores.

## [2.0.0] – Corte 2: arquitectura hexagonal

- Arquitectura hexagonal (puertos y adaptadores), retos de autenticación con QR, contacto de
  emergencia y planeación de viajes, persistencia en SQLite, pruebas unitarias, de integración y de carga.

## [1.0.0] – Corte 1

- Backend en Express con Factory Method y Observer, y app móvil en Expo.
