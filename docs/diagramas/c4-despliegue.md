# Vista de despliegue (C4 – despliegue)

Muestra dónde corre cada contenedor de WHEELS y cómo se comunican. Corresponde a lo que despliega `.github/workflows/cd.yml` con `docker-compose.yml` (decisión en el [ADR-002](../adr/ADR-002-estrategia-de-despliegue.md)).

```mermaid
flowchart TB
    subgraph celular["Celular del estudiante (Android / iOS)"]
        app["App móvil WHEELS<br/>Expo Go · React Native<br/>(no se despliega en el servidor)"]
    end

    subgraph github["GitHub (nube)"]
        repo["Repositorio<br/>main protegida"]
        actions["GitHub Actions<br/>ci.yml · cd.yml<br/>runners ubuntu-latest"]
        ghcr[("GHCR<br/>ghcr.io/danielforero14/wheels-backend<br/>etiquetas sha-&lt;commit&gt; y X.Y.Z")]
    end

    subgraph servidor["Máquina del equipo · Windows 11 + WSL 2 (Ubuntu) + Docker Desktop"]
        runner["Runner autohospedado<br/>wheels-wsl (etiqueta wheels)<br/>servicio systemd en WSL"]
        subgraph compose["Docker Compose · proyecto wheels-produccion"]
            backend["Contenedor backend<br/>node:24.22.2-bookworm-slim<br/>usuario node · solo lectura<br/>puerto 3000 → publicado en 8091"]
            volumen[("Volumen datos-wheels<br/>/app/datos/wheels.db (SQLite)")]
            k6["Contenedor k6 (grafana/k6:2.3.0)<br/>solo durante la prueba del SLO<br/>perfil 'pruebas'"]
        end
    end

    subgraph externos["Servicios externos"]
        osm["OpenStreetMap<br/>Nominatim + OSRM (HTTPS)"]
    end

    app -- "HTTP/JSON + token Bearer<br/>:8091 (red local)" --> backend
    backend -- "lee y escribe el archivo" --> volumen
    backend -- "direcciones y rutas (HTTPS)" --> osm
    k6 -- "HTTP · red interna de Compose<br/>http://backend:3000" --> backend

    repo --> actions
    actions -- "publica la imagen" --> ghcr
    runner -- "pide trabajos (HTTPS saliente)" --> actions
    runner -- "docker compose pull / up --wait" --> ghcr
    runner -- "crea y reemplaza" --> backend
```

| Elemento | Dónde corre | Detalle |
|---|---|---|
| `backend` | Contenedor en la máquina del equipo | Imagen de GHCR con la etiqueta `sha-<commit>` del despliegue. Healthcheck `GET /salud`. Variables: `SECRETO_TOKEN` (de GitHub Secrets), `RUTA_BD=/app/datos/wheels.db`, `VERSION_APP` (dentro de la imagen). `read_only`, `cap_drop: ALL`, `no-new-privileges` |
| Volumen `datos-wheels` | Docker (dentro de Docker Desktop) | Archivo SQLite; sobrevive a los despliegues y a `docker compose down` (se borra solo con `down -v`) |
| `k6` | Contenedor temporal en la misma red | Solo existe durante `scripts/slo.sh` (después de cada despliegue y en `carga-larga.yml`) |
| Runner `wheels-wsl` | Servicio de systemd en WSL | Hace conexiones salientes a GitHub; ejecuta los jobs `desplegar`, `revertir` y `carga` |
| App móvil | Celular de cada estudiante | Se conecta a `http://<IP-de-la-máquina>:8091` en la red local. Detalle en `implementacion.md` |
| GHCR | GitHub | Registro de las imágenes; el runner descarga con el `GITHUB_TOKEN` del job (`packages: read`) |
| OpenStreetMap | Internet | Servicio de rutas real (Reto 3). Si falla, el backend usa el respaldo `RutasEstimadas` |

**Puertos de la máquina:** 8091 (WHEELS en producción), 3000 (WHEELS en desarrollo, si se levanta con `docker compose up` desde el `.env` de desarrollo).
