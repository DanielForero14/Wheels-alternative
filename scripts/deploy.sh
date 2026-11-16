#!/usr/bin/env bash
# Despliega una versión de la imagen del backend con Docker Compose y espera a que quede saludable.
#
# Uso:
#   scripts/deploy.sh <imagen:tag>
# Ejemplos:
#   scripts/deploy.sh ghcr.io/<usuario-github>/wheels-backend:sha-1a2b3c4   (del registro: se descarga)
#   scripts/deploy.sh wheels-backend:dev                                    (imagen local: no se descarga)
#
# Variables (del entorno o del archivo .env): SECRETO_TOKEN (obligatoria), PUERTO_BACKEND,
# COMPOSE_PROJECT_NAME (en el pipeline: wheels-produccion, para no mezclarse con el entorno de desarrollo).
# El script guarda en $DEPLOY_STATE_DIR (por defecto ~/.wheels-despliegue) qué imagen estaba antes,
# para que scripts/rollback.sh pueda volver a ella.
# Adaptado del taller DevSecOps.
set -euo pipefail

IMAGEN="${1:?Uso: scripts/deploy.sh <imagen:tag>}"
ESTADO_DIR="${DEPLOY_STATE_DIR:-$HOME/.wheels-despliegue}"
cd "$(dirname "$0")/.."
mkdir -p "$ESTADO_DIR"

echo "==> Desplegando $IMAGEN (proyecto ${COMPOSE_PROJECT_NAME:-wheels})"
export IMAGEN_BACKEND="$IMAGEN"

# Si la imagen viene de un registro (tiene "/"), se descarga. Una imagen local se usa tal cual.
if [[ "$IMAGEN" == */* ]]; then
  docker compose pull backend
fi

# Se registra la versión que estaba desplegada antes de cambiarla.
ACTUAL="$(cat "$ESTADO_DIR/actual" 2>/dev/null || true)"
if [[ -n "$ACTUAL" && "$ACTUAL" != "$IMAGEN" ]]; then
  echo "$ACTUAL" > "$ESTADO_DIR/anterior"
fi
echo "$IMAGEN" > "$ESTADO_DIR/actual"

# --wait espera a que el contenedor esté "healthy" (/salud); si no lo logra, el comando (y el script) falla.
docker compose up -d --no-build --wait --wait-timeout 120 backend

echo "==> $IMAGEN desplegada y saludable"
docker compose ps backend
