# Guía de implementación de WHEELS

**Para quién es:** el equipo técnico de la Universidad de La Sabana (o de la organización que adopte WHEELS), que conoce Docker y Git pero no conoce este proyecto. La guía lleva desde una cuenta y un servidor vacíos hasta el sistema funcionando, y explica cómo operarlo después.

**Convenciones:**
- Los valores que usted debe cambiar van entre `<` y `>`: `<usuario-github>`, `<IP-del-servidor>`, `<clave-generada>`.
- Los comandos se ejecutan en el **servidor** (Ubuntu), salvo que el paso diga otra cosa.
- Los nombres de variables, servicios, scripts y workflows son los del repositorio: `.env.example`, `docker-compose.yml`, `scripts/` y `.github/workflows/`.
- Para ampliar un tema se enlaza [devops.md](devops.md), [seguridad.md](seguridad.md) o el [README](../README.md), pero todos los pasos están aquí.

---

## 1. Qué se va a implementar

WHEELS organiza los viajes compartidos entre estudiantes: cada estudiante ingresa con su correo institucional y un código que recibe por correo; los conductores registran su vehículo y programan viajes; los pasajeros los buscan, ven cuánto se demoran desde donde están, solicitan un cupo y abordan mostrando un código QR que el conductor valida; y un botón de pánico avisa al contacto de emergencia.

Componentes que se instalan:

| Componente | Qué es | Dónde corre |
|---|---|---|
| **backend** | API REST (Node.js 24 + Express) con arquitectura hexagonal | Contenedor Docker en el servidor, imagen `ghcr.io/<usuario-github>/wheels-backend` |
| **Base de datos** | SQLite (archivo `wheels.db`) | Volumen de Docker `wheels-produccion_datos-wheels` en el servidor |
| **Pipeline** | GitHub Actions: `ci.yml` (pruebas y controles), `cd.yml` (publicar, desplegar, verificar, revertir), `carga-larga.yml` | Runners de GitHub + un **runner autohospedado** en el servidor |
| **Registro de imágenes** | GitHub Container Registry (GHCR) | GitHub |
| **App móvil** | Expo / React Native | Celular de cada estudiante (Expo Go) |
| **Servicio de mapas** | OpenStreetMap (Nominatim y OSRM públicos) | Internet |

Dónde corre cada pieza y cómo se comunican: [vista de despliegue](diagramas/c4-despliegue.md).

## 2. Requisitos previos

**Cuentas y servicios**

| Qué | Para qué | Notas |
|---|---|---|
| Cuenta u organización de **GitHub** | Repositorio, GitHub Actions y GHCR | Con repositorio **público**, Actions y GHCR son gratuitos. Con uno privado aplican los minutos y el almacenamiento del plan |
| Un **servidor** con acceso a Internet de salida | Correr el backend y el runner | Una máquina virtual en la nube o un servidor propio de la universidad |
| (Opcional) **Dominio** y **certificado HTTPS** | Exponer la API con HTTPS | Recomendado para producción (sección 9) |

**Software del servidor**

| Software | Versión | Cómo comprobarla |
|---|---|---|
| Ubuntu Server (o Ubuntu en WSL 2 sobre Windows 11) | 22.04 o 24.04 LTS | `lsb_release -a` |
| Docker Engine | 24 o superior | `docker version` |
| Docker Compose (plugin) | 2.20 o superior (necesario para `up --wait`) | `docker compose version` |
| Git | 2.30 o superior | `git --version` |
| curl, openssl, tar | Las de Ubuntu | Vienen instalados |

**Software en el equipo de quien prepara la app** (solo para el paso 5.9): Node.js 22.8 o superior y Git. En los celulares: la app **Expo Go** (Android o iOS).

**Recursos mínimos del servidor:** 2 vCPU, 2 GB de RAM y 10 GB de disco libres (la imagen ocupa ~250 MB; el resto es para el runner, las imágenes anteriores para revertir y las copias de seguridad).

**Red y puertos**

| Puerto | Sentido | Para qué |
|---|---|---|
| 8091/TCP (configurable con `PUERTO_BACKEND`) | Entrada, desde la red de los estudiantes | API de WHEELS |
| 443/TCP | Salida | `github.com`, `ghcr.io`, `*.actions.githubusercontent.com` (runner), `nominatim.openstreetmap.org`, `router.project-osrm.org` (mapas) |

El runner autohospedado **no necesita puertos de entrada**: solo hace conexiones salientes hacia GitHub.

## 3. Costos estimados

Precios de referencia en dólares, aproximados a noviembre de 2026; confírmelos en la calculadora de cada proveedor antes de decidir.

| Componente | Plan usado en el proyecto | Costo mensual | Plan recomendado para la universidad | Costo mensual aproximado |
|---|---|---|---|---|
| Servidor | Computador del equipo (Windows 11 + WSL 2 + Docker Desktop) | US$ 0 | Máquina virtual de 2 vCPU y 4 GB de RAM (por ejemplo Azure B2s, AWS t3.medium, DigitalOcean 4 GB) o un servidor propio de la universidad | US$ 25 – 40 (nube) · US$ 0 adicional (servidor propio) |
| GitHub (repositorio, Actions, GHCR) | Gratuito, repositorio público | US$ 0 | Organización gratuita con repositorio público; o GitHub Team si el código debe ser privado | US$ 0 · US$ 4 por usuario (Team) |
| Disco para copias de seguridad | Volumen local | US$ 0 | Almacenamiento de objetos (Azure Blob, S3) para las copias diarias | US$ 1 – 5 |
| Dominio | No se usó | US$ 0 | Subdominio de la universidad (`wheels.unisabana.edu.co`) o dominio propio | US$ 0 · ~US$ 1 (US$ 12 al año) |
| Certificado HTTPS | No se usó | US$ 0 | Let's Encrypt (renovación automática con Caddy o Certbot) | US$ 0 |
| Correo (código de ingreso) | Simulado en consola | US$ 0 | Servicio transaccional (SendGrid, Amazon SES) o el SMTP institucional | US$ 0 – 20 según el volumen |
| SMS (alertas de emergencia) | Simulado en consola | US$ 0 | Proveedor de SMS (por ejemplo Twilio); se paga por mensaje enviado | Variable: solo se envía cuando alguien activa el botón de pánico |
| Mapas | OpenStreetMap público | US$ 0 | Servidor propio de Nominatim/OSRM, o un proveedor con tráfico en vivo | US$ 0 – 50 |
| **Total** | | **US$ 0** | | **~US$ 30 – 120** según las opciones |

Correo, SMS y mapas de pago requieren escribir un adaptador nuevo del puerto correspondiente (sección 9); con el código actual no generan costo.

## 4. Configuración

Todas las variables y secretos que usa el sistema. Ninguna contraseña, token o clave va en el código ni en la imagen.

| Nombre | Para qué sirve | Valor de ejemplo | ¿Obligatoria? | Dónde se configura | Cómo generar el valor |
|---|---|---|---|---|---|
| `SECRETO_TOKEN` | Clave con la que la API firma los tokens de sesión. Quien la conozca puede hacerse pasar por cualquier usuario | `9f2c…` (64 caracteres hexadecimales) | **Sí** (mínimo 32 caracteres) | Producción: **GitHub → environment `produccion` → Secrets**. Desarrollo: archivo `.env` | `openssl rand -hex 32` |
| `PUERTO_BACKEND` | Puerto del servidor donde se publica la API | `8091` | No (8091 en el pipeline, 3000 con `.env`) | Producción: environment `produccion` → **Variables**. Desarrollo: `.env` | — |
| `APP_URL` | URL que GitHub muestra en cada despliegue del environment | `http://<IP-del-servidor>:8091` | No | Environment `produccion` → Variables | — |
| `DESPLIEGUE` | Interruptor: si no vale `activo`, los jobs del runner no corren (útil mientras no hay runner) | `activo` | **Sí**, para desplegar | GitHub → **Settings → Secrets and variables → Actions → Variables** (del repositorio) | — |
| `IMAGEN_BACKEND` | Imagen que levanta Compose | `wheels-backend:dev` (desarrollo) · `ghcr.io/<usuario-github>/wheels-backend:sha-1a2b3c4` (la pone el pipeline) | No | `.env` (desarrollo); en producción la define `scripts/deploy.sh` | — |
| `COMPOSE_PROJECT_NAME` | Nombre del proyecto de Compose; separa producción de otros entornos en la misma máquina | `wheels-produccion` | No (la pone el pipeline) | `cd.yml` | — |
| `RUTA_BD` | Ruta del archivo SQLite dentro del contenedor | `/app/datos/wheels.db` | No (fija en `docker-compose.yml`) | `docker-compose.yml` | — |
| `PORT` | Puerto interno del contenedor | `3000` | No (fijo) | `docker-compose.yml` | — |
| `VERSION_APP` | Versión que responde `/salud` | `3.0.0` o `3.0.0+sha.1a2b3c4` | No (la pone el pipeline al construir) | Argumento `VERSION` del `Dockerfile` | — |
| `GITHUB_TOKEN` | Publicar y descargar la imagen en GHCR desde el pipeline | (automático) | — | Lo crea GitHub en cada ejecución | No se configura |
| `EXPO_PUBLIC_API_URL` | Dirección de la API que usa la app móvil | `http://<IP-del-servidor>:8091` | Sí, para que la app use producción | Variable de entorno al ejecutar `npx expo start` | — |
| `SLO_DURACION`, `SLO_TASA` | Duración y búsquedas por segundo de la prueba de carga | `30s`, `20` | No | Entrada del workflow `carga-larga.yml` o variable al ejecutar `scripts/slo.sh` | — |
| `BASE_URL` | URL contra la que corre la prueba de humo | `http://localhost:8091` | No (la pone el pipeline) | `cd.yml` o al ejecutar `scripts/smoke-test.sh` | — |
| `DEPLOY_STATE_DIR` | Carpeta donde el despliegue guarda la imagen actual y la anterior (para revertir) | `~/.wheels-despliegue` | No | Variable al ejecutar los scripts | — |

## 5. Instalación paso a paso

### 5.1 Preparar el servidor

1. Instale Docker Engine con el script oficial de Docker:

   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh && sudo sh get-docker.sh
   ```

   Resultado esperado: termina sin errores.

2. Permita que su usuario use Docker sin `sudo` y abra una sesión nueva:

   ```bash
   sudo usermod -aG docker $USER && newgrp docker
   ```

3. Compruebe las versiones:

   ```bash
   docker version --format '{{.Server.Version}}' && docker compose version
   ```

   Resultado esperado: Docker 24 o superior y `Docker Compose version v2.20` o superior.

> Si el servidor es un computador con Windows 11, instale **Docker Desktop** con la integración de WSL 2 activada y haga los demás pasos dentro de Ubuntu (WSL). Así se ejecutó en el proyecto.

### 5.2 Crear el repositorio de la organización

1. En GitHub, con la cuenta u organización de la universidad, abra `https://github.com/DanielForero14/Wheels-alternative` y pulse **Fork** (o importe el repositorio con *New repository → Import a repository*). Resultado esperado: el repositorio `https://github.com/<usuario-github>/Wheels-alternative`.
2. En el repositorio nuevo, abra la pestaña **Actions** y pulse **I understand my workflows, go ahead and enable them** (en un *fork* vienen apagados).
3. En **Settings → Actions → General → Fork pull request workflows from outside collaborators**, elija **Require approval for all outside collaborators**, para que nadie externo ejecute código en su runner (amenaza A12 de [seguridad.md](seguridad.md)).

La imagen se publicará como `ghcr.io/<usuario-github>/wheels-backend`: `cd.yml` toma el dueño del repositorio automáticamente, no hay que editar nada.

### 5.3 Generar el secreto

En el servidor:

```bash
openssl rand -hex 32
```

Resultado esperado: una línea de 64 caracteres. Guárdela en el gestor de contraseñas de la universidad; se usa en el paso siguiente y **no** se escribe en ningún archivo del repositorio.

### 5.4 Configurar el environment y las variables en GitHub

1. **Settings → Environments → New environment**, nombre `produccion`, **Configure environment**.
2. En **Deployment branches and tags** elija **Selected branches and tags** y agregue la rama `main` y el patrón de tag `v*.*.*`.
3. En **Environment secrets → Add environment secret**: nombre `SECRETO_TOKEN`, valor el del paso 5.3.
4. En **Environment variables → Add environment variable**: `PUERTO_BACKEND` = `8091` y `APP_URL` = `http://<IP-del-servidor>:8091`.
5. **Settings → Secrets and variables → Actions → pestaña Variables → New repository variable**: `DESPLIEGUE` = `activo`.

Resultado esperado: el environment `produccion` muestra 1 secreto y 2 variables, y la variable `DESPLIEGUE` aparece en *Repository variables*.

### 5.5 Proteger la rama main

**Settings → Rules → Rulesets → New ruleset → New branch ruleset**:

1. Nombre `proteger-main`, *Enforcement status* **Active**, *Target branches* **Include default branch**.
2. Marque **Restrict deletions**, **Block force pushes** y **Require a pull request before merging** con *Required approvals* = `1`.
3. Marque **Require status checks to pass** y agregue: `Construcción`, `Reglas de arquitectura`, `Pruebas unitarias y cobertura del dominio`, `Pruebas de integración`, `App móvil (tipos y lint)`, `SAST (CodeQL)`, `SCA (dependencias con Trivy)`, `Secretos (Gitleaks)` e `Imagen Docker y escaneo (Trivy)`. (Los checks aparecen en la lista después de que el CI haya corrido al menos una vez, por ejemplo con un Pull Request.)
4. **Create**.

### 5.6 Registrar el runner autohospedado

1. En GitHub: **Settings → Actions → Runners → New self-hosted runner**, sistema **Linux**, arquitectura **x64**. La página muestra un token de registro (dura 1 hora).
2. En el servidor, descargue el runner (use la versión que indique esa página; aquí la 2.338.2):

   ```bash
   mkdir -p ~/actions-runner-wheels && cd ~/actions-runner-wheels
   ```
   ```bash
   curl -o runner.tar.gz -L https://github.com/actions/runner/releases/download/v2.338.2/actions-runner-linux-x64-2.338.2.tar.gz && tar xzf runner.tar.gz
   ```

3. Regístrelo con la etiqueta **`wheels`** (los workflows la buscan):

   ```bash
   ./config.sh --url https://github.com/<usuario-github>/Wheels-alternative --token <token-de-registro> --name wheels-servidor --labels wheels --unattended
   ```

   Resultado esperado: `√ Runner successfully added` y `√ Settings Saved`.

4. Instálelo como servicio para que arranque solo con el servidor:

   ```bash
   sudo ./svc.sh install && sudo ./svc.sh start
   ```

   Resultado esperado: `Active: active (running)`. En GitHub, **Settings → Actions → Runners** muestra `wheels-servidor` en estado **Idle**.

### 5.7 Primer despliegue

El despliegue se dispara con un push a `main` o con un tag de versión. Para el primero, cree el tag de la versión actual desde su equipo (con Git y el repositorio clonado):

```bash
git clone https://github.com/<usuario-github>/Wheels-alternative.git && cd Wheels-alternative
```
```bash
git tag -a v3.0.0 -m "WHEELS 3.0.0 - primera instalación" && git push origin v3.0.0
```

Resultado esperado, en **Actions → CD** (unos 5 minutos):

1. El job **CI** en verde (todas las pruebas y los controles de seguridad).
2. **Publicar la imagen en GHCR** en verde. En la página del repositorio, *Packages* muestra `wheels-backend` con las etiquetas `3.0.0` y `sha-…`.
3. **Desplegar y verificar** en verde, con los pasos *Desplegar con Docker Compose*, *Prueba de humo* (termina con `==> Prueba de humo superada`) y *Prueba de carga del SLO* (`✓ 'p(95)<=500'` y `✓ 'rate<0.01'`).

### 5.8 Datos iniciales y primer usuario

- **Datos iniciales:** no hay que cargar nada. La API crea las tablas de SQLite al arrancar (`CREATE TABLE IF NOT EXISTS`) y la base empieza vacía. (Los 500 viajes de ejemplo de `npm run start:carga` son solo para pruebas de carga y nunca se cargan en producción.)
- **Primer administrador:** WHEELS **no tiene rol de administrador**. Cada estudiante crea su propio usuario al ingresar con su correo `@unisabana.edu.co` y el código que recibe; elige si es pasajero o conductor. La prueba de humo deja dos usuarios de prueba (`humo.conductor@unisabana.edu.co` y `humo.pasajera@unisabana.edu.co`) que no pertenecen a nadie.
- **Mientras el correo sea simulado** (ver sección 9), el código de ingreso de cada estudiante aparece en los logs del contenedor: el personal de soporte lo consulta con el comando de la sección 7.5 y se lo entrega al estudiante.

### 5.9 Conectar la app móvil

En el equipo de quien distribuye la app, con el repositorio clonado:

```bash
cd mobile && npm ci
```
```bash
EXPO_PUBLIC_API_URL=http://<IP-del-servidor>:8091 npx expo start
```

Resultado esperado: un código QR en la terminal. Cada estudiante lo escanea con **Expo Go** (el celular debe poder llegar a `<IP-del-servidor>:8091`). En Windows (PowerShell) la variable se define con `$env:EXPO_PUBLIC_API_URL="http://<IP-del-servidor>:8091"; npx expo start`.

## 6. Verificación

1. **Healthcheck** desde el servidor:

   ```bash
   curl http://localhost:8091/salud
   ```

   Resultado esperado: `{"estado":"ok","version":"3.0.0"}`.

2. **Estado del contenedor:**

   ```bash
   docker ps --filter name=wheels-produccion-backend --format '{{.Names}} {{.Status}} {{.Image}}'
   ```

   Resultado esperado: `wheels-produccion-backend-1 Up … (healthy) ghcr.io/<usuario-github>/wheels-backend:sha-…`.

3. **Prueba de humo** (la misma del pipeline), desde la carpeta del repositorio que usa el runner:

   ```bash
   cd ~/actions-runner-wheels/_work/Wheels-alternative/Wheels-alternative
   ```
   ```bash
   COMPOSE_PROJECT_NAME=wheels-produccion BASE_URL=http://localhost:8091 scripts/smoke-test.sh
   ```

   Resultado esperado: 13 líneas `ok` y `==> Prueba de humo superada`.

4. **Recorrido corto con la app** (dos celulares o dos sesiones):
   1. Ingresar como **conductor** con un correo institucional (código en los logs, sección 7.5), registrar **Mi vehículo** y programar un viaje para mañana.
   2. Ingresar como **pasajero** con otro correo, buscar el viaje y **Solicitar cupo**.
   3. Como conductor, **Aceptar** en *Solicitudes*. Como pasajero, ver el QR en *Mis reservas*.
   4. Como conductor, **Validar QR** escaneándolo: debe decir *Abordaje confirmado*.

## 7. Operación

El contenedor de producción se llama **`wheels-produccion-backend-1`** y su volumen **`wheels-produccion_datos-wheels`**. Las tareas diarias (logs, detener, iniciar, reiniciar, copias) usan comandos `docker` directos sobre ellos, que no necesitan el secreto. Los scripts del repositorio (`rollback.sh`, `smoke-test.sh`) se ejecutan desde la carpeta que usa el runner:

```bash
cd ~/actions-runner-wheels/_work/Wheels-alternative/Wheels-alternative
```

### 7.1 Publicar una nueva versión

1. Haga el cambio en una rama, abra un Pull Request hacia `main` y espere los checks en verde.
2. Pida la aprobación de otra persona del equipo y fusione. Resultado esperado: **Actions → CD** despliega la nueva imagen (`sha-<commit>`) y la verifica.
3. Para marcar una versión, actualice `version` en `backend/package.json` y agregue su entrada en `CHANGELOG.md` (en el mismo Pull Request); después de fusionar:

   ```bash
   git checkout main && git pull && git tag -a v<X.Y.Z> -m "WHEELS <X.Y.Z>" && git push origin v<X.Y.Z>
   ```

   Resultado esperado: la imagen también queda con la etiqueta `<X.Y.Z>` y `/salud` responde esa versión.

### 7.2 Volver a la versión anterior

- **Automático:** si un despliegue falla la prueba de humo o el SLO, el pipeline vuelve solo a la versión anterior.
- **Desde GitHub (recomendado):** **Actions → CD → Run workflow**, en *tag* escriba la etiqueta a la que quiere volver (`3.0.0` o `sha-1a2b3c4`; las disponibles están en *Packages → wheels-backend*) y pulse **Run workflow**. Resultado esperado: el job **Reversión manual** en verde y `/salud` con esa versión.
- **En el servidor** (si GitHub no está disponible), desde la carpeta del runner y con la imagen ya descargada:

  ```bash
  COMPOSE_PROJECT_NAME=wheels-produccion SECRETO_TOKEN=<clave-generada> PUERTO_BACKEND=8091 scripts/rollback.sh ghcr.io/<usuario-github>/wheels-backend:<tag>
  ```

  Resultado esperado: `==> Reversión a …`, `desplegada y saludable` y `==> Prueba de humo superada`.

### 7.3 Copia de seguridad de los datos

La base es un solo archivo dentro del volumen `wheels-produccion_datos-wheels`. Se detiene la API unos segundos para que el archivo quede consistente:

```bash
mkdir -p ~/respaldos-wheels && docker stop wheels-produccion-backend-1
```
```bash
docker run --rm -v wheels-produccion_datos-wheels:/datos:ro -v ~/respaldos-wheels:/respaldo alpine:3.20 cp /datos/wheels.db /respaldo/wheels-$(date +%F-%H%M).db
```
```bash
docker start wheels-produccion-backend-1 && ls -lh ~/respaldos-wheels
```

Resultado esperado: un archivo `wheels-AAAA-MM-DD-HHMM.db` y, a los pocos segundos, el contenedor otra vez *healthy* (`docker ps --filter name=wheels-produccion`).

### 7.4 Restaurar una copia de seguridad

```bash
docker stop wheels-produccion-backend-1
```
```bash
docker run --rm -v wheels-produccion_datos-wheels:/datos -v ~/respaldos-wheels:/respaldo:ro alpine:3.20 sh -c "cp /respaldo/<archivo-de-respaldo>.db /datos/wheels.db && chown 1000:1000 /datos/wheels.db"
```
```bash
docker start wheels-produccion-backend-1 && sleep 15 && curl http://localhost:8091/salud
```

Resultado esperado: `{"estado":"ok",…}` y los datos de la fecha de la copia (los viajes y usuarios que existían ese día). (El usuario `node` del contenedor tiene el UID 1000; por eso el `chown`.)

### 7.5 Consultar los logs

```bash
docker logs --tail 100 -f wheels-produccion-backend-1
```

Para ver el código de ingreso de un estudiante (mientras el correo sea simulado):

```bash
docker logs wheels-produccion-backend-1 2>&1 | grep "EMAIL a <correo-del-estudiante>" | tail -1
```

Los logs del pipeline están en **Actions** (cada ejecución) y los del runner en `~/actions-runner-wheels/_diag/`.

### 7.6 Cambiar un secreto (rotar `SECRETO_TOKEN`)

1. Genere una clave nueva con `openssl rand -hex 32`.
2. GitHub → **Settings → Environments → produccion → SECRETO_TOKEN → Update secret** y pegue la clave nueva.
3. Vuelva a desplegar la versión actual: **Actions → CD → Run workflow** con el tag que está desplegado (por ejemplo `3.0.0`).

Resultado esperado: la reversión manual termina en verde. **Todas las sesiones abiertas se cierran** (los estudiantes deben volver a ingresar); es el procedimiento a seguir si sospecha que la clave se filtró.

### 7.7 Reiniciar un servicio

```bash
docker restart wheels-produccion-backend-1 && sleep 15 && docker ps --filter name=wheels-produccion --format '{{.Names}} {{.Status}}'
```

Resultado esperado: `wheels-produccion-backend-1 … (healthy)` en unos segundos. Para reiniciar el runner: `cd ~/actions-runner-wheels && sudo ./svc.sh stop && sudo ./svc.sh start`.

## 8. Solución de problemas

| # | Síntoma | Causa | Cómo resolverlo |
|---|---|---|---|
| 1 | En **Actions → CD**, el job *Desplegar y verificar* se queda en *Waiting for a runner to pick up this job* | El runner está apagado o el servidor no tiene Internet | En el servidor: `cd ~/actions-runner-wheels && sudo ./svc.sh status`. Si no está *active*, `sudo ./svc.sh start`. En GitHub el runner debe verse *Idle* |
| 2 | Los jobs *Desplegar y verificar* y *Reversión manual* aparecen como *skipped* (gris) | La variable del repositorio `DESPLIEGUE` no existe o no vale `activo` | Crear o corregir la variable (paso 5.4, punto 5) y volver a ejecutar el workflow |
| 3 | El paso *Desplegar* falla con `required variable SECRETO_TOKEN is missing a value` | Falta el secreto `SECRETO_TOKEN` en el environment `produccion`, o el job no está usando ese environment | Revisar el paso 5.4 (el secreto debe estar en el **environment**, no solo en el repositorio). Al ejecutar a mano, exportar la variable o crear el `.env` |
| 4 | El paso *Desplegar* falla con `denied` o `unauthorized` al descargar de `ghcr.io` | El paquete `wheels-backend` no le da acceso al repositorio (pasa si el paquete se creó desde otro repositorio) | En GitHub → *Packages → wheels-backend → Package settings → Manage Actions access*, agregar el repositorio con rol **Read**. Si el paquete es privado, también se puede hacer **public** |
| 5 | `Bind for 0.0.0.0:8091 failed: port is already allocated` | Otro programa o contenedor usa el puerto 8091 | Ver quién lo usa: `docker ps --format '{{.Names}} {{.Ports}}'`. Liberarlo o cambiar la variable `PUERTO_BACKEND` del environment (y `APP_URL`, y la URL de la app) |
| 6 | La prueba de humo falla con `no apareció el código de ingreso de … en los logs` | La prueba lee los logs de otro proyecto de Compose (se ejecutó a mano sin `COMPOSE_PROJECT_NAME`) | Ejecutarla con `COMPOSE_PROJECT_NAME=wheels-produccion` desde la carpeta del repositorio del runner (sección 6) |
| 7 | La app muestra *No hay conexión con el servidor* | La app no apunta al servidor, el celular no llega a esa red o un firewall bloquea el puerto | Arrancar la app con `EXPO_PUBLIC_API_URL=http://<IP-del-servidor>:8091`; probar `http://<IP-del-servidor>:8091/salud` desde el navegador del celular; abrir el puerto 8091 en el firewall del servidor (`sudo ufw allow 8091/tcp`) |
| 8 | Todos los estudiantes reciben *Inicia sesión para continuar* | Cambió `SECRETO_TOKEN` (rotación) o el token venció (12 horas) | Es el comportamiento esperado: volver a ingresar con el correo |
| 9 | Un estudiante recibe *Demasiados intentos fallidos, pide un código nuevo* | Escribió mal el código 5 veces (protección contra fuerza bruta) | Pedir un código nuevo desde la pantalla de ingreso |
| 10 | "¿Cuánto me demoro?" responde con la fuente `RutasEstimadas` o tiempos aproximados | El servidor no llega a OpenStreetMap o este limitó las peticiones; la API usa el respaldo | Comprobar la salida a Internet: `curl -I https://router.project-osrm.org`. Para producción, ver la sección 9 (servidor de mapas propio) |
| 11 | `permission denied while trying to connect to the Docker daemon socket` en los jobs del runner | El usuario que corre el servicio del runner no pertenece al grupo `docker` | `sudo usermod -aG docker <usuario-del-runner>` y reiniciar el runner (sección 7.7) |
| 12 | El pipeline de CI falla en *SCA*, *Secretos* o *SAST* | Un cambio trajo una dependencia vulnerable, una clave o código inseguro | Ver el log del job y el artefacto `reporte-…`; corregir. Si es un falso positivo, registrarlo en `docs/seguridad.md` antes de agregar la excepción (ver [seguridad.md](seguridad.md), sección 4) |

## 9. Recomendaciones para producción

Lo que la universidad debe cambiar respecto al entorno del proyecto:

1. **Credenciales:** generar su propia `SECRETO_TOKEN` (nunca reutilizar la del proyecto) y rotarla cada semestre o ante cualquier sospecha (sección 7.6). Guardarla en el gestor de contraseñas institucional.
2. **HTTPS:** no exponer el puerto 8091 directamente a Internet. Poner delante un *proxy* inverso con certificado (por ejemplo Caddy, que obtiene y renueva el certificado de Let's Encrypt solo), publicar `https://wheels.<dominio>` y dejar el 8091 accesible solo desde el *proxy*. Sin HTTPS el token de sesión viaja en texto plano.
3. **Correo y SMS reales:** el código de ingreso, los avisos y las alertas de emergencia hoy se escriben en la consola. Antes de abrir el sistema a los estudiantes hay que implementar un adaptador del puerto `INotificador` para el correo institucional (o SendGrid/SES) y otro para SMS (Twilio u otro), y conectarlos en `backend/src/configuracion.js`. Sin esto, el botón de pánico no llega al contacto.
4. **Copias de seguridad programadas:** ejecutar la copia de la sección 7.3 cada noche con `cron` y llevar los archivos a un almacenamiento fuera del servidor; probar una restauración (7.4) al menos una vez por semestre.
5. **Tamaño de los recursos:** 2 vCPU y 4 GB de RAM alcanzan para el uso esperado (el SLO se cumplió con 200 usuarios simultáneos en el Corte 2). Si se necesitan varias instancias, primero hay que cambiar SQLite por una base de servidor (PostgreSQL) con un adaptador nuevo de `IRepositorioViajes`.
6. **Dos entornos:** agregar un environment `pruebas` para que la prueba de humo y la de carga no creen datos en producción, y exigir aprobación manual (*Required reviewers*) en `produccion`.
7. **Mapas:** los servidores públicos de OpenStreetMap limitan a 1 petición por segundo. Con muchos estudiantes, usar un servidor propio de Nominatim/OSRM o un proveedor de pago (otro adaptador de `IServicioRutas`).
8. **Firewall:** abrir solo el puerto del *proxy* (443); el runner no necesita puertos de entrada.
9. **Riesgos aceptados que siguen abiertos** (detalle en [seguridad.md](seguridad.md), sección 5):
   - **H-02 y H-03:** dependencias de la app móvil con vulnerabilidades altas que solo se corrigen migrando a una versión nueva de Expo.
   - **H-08:** no hay bitácora de auditoría de quién aceptó, canceló o validó cada viaje.
   - **H-09:** no hay límite de peticiones por cliente en la API (se recomienda configurarlo en el *proxy* del punto 2).
   - El token dura 12 horas y no se puede revocar individualmente; solo rotando `SECRETO_TOKEN`.
