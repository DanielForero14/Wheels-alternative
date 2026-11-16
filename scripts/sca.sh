#!/usr/bin/env bash
# Quality gate de análisis de dependencias (SCA) con Trivy, sobre todo el repositorio:
# backend/package-lock.json (lo que va en la imagen) y mobile/package-lock.json (la app).
# Umbral: ninguna vulnerabilidad HIGH o CRITICAL que tenga corrección disponible. Si hay, el script falla.
# Trivy no cuenta las dependencias de desarrollo de npm (pruebas, lint), solo las que usa el sistema.
#
# Uso:
#   scripts/sca.sh
# Deja el reporte completo (todas las severidades) en reportes/trivy-dependencias.json.
# Adaptado del taller DevSecOps (allí se usaba Maven; aquí Trivy lee los package-lock.json).
set -euo pipefail
cd "$(dirname "$0")/.."

TRIVY_IMAGEN="${TRIVY_IMAGEN:-aquasec/trivy:0.76.0}"
RAIZ="$(pwd)"
# En Git Bash (Windows), Docker necesita rutas con el formato C:/... y sin conversión automática.
if pwd -W > /dev/null 2>&1; then
  export MSYS_NO_PATHCONV=1
  RAIZ="$(pwd -W)"
fi
mkdir -p reportes

trivy() {
  docker run --rm -v "$RAIZ:/src" -v trivy-cache:/root/.cache \
    "$TRIVY_IMAGEN" fs --scanners vuln --skip-dirs "**/node_modules" --ignorefile /src/.trivyignore "$@" /src
}

echo "==> Reporte completo: reportes/trivy-dependencias.json"
trivy --quiet --format json --output /src/reportes/trivy-dependencias.json

echo "==> Quality gate: HIGH o CRITICAL con corrección disponible"
trivy --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1
