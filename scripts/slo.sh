#!/usr/bin/env bash
# Verifica el SLO con una prueba de carga corta (k6) contra el sistema desplegado con Docker Compose.
# Los umbrales están en perf/slo.js: si no se cumplen, k6 termina con un código distinto de 0 y este script falla.
#
# Uso:
#   scripts/slo.sh
#   SLO_DURACION=5m SLO_TASA=60 scripts/slo.sh     (prueba más larga)
# Requiere que la prueba de humo haya corrido antes (deja un conductor verificado con vehículo).
# El resumen de k6 queda también en reportes/slo.txt.
# Adaptado del taller DevSecOps.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p reportes

# k6 corre como un servicio de Compose (perfil "pruebas") dentro de la misma red que el backend.
docker compose --profile pruebas run --rm k6 2>&1 | tee reportes/slo.txt
