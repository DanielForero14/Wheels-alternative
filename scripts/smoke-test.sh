#!/usr/bin/env bash
# Prueba de humo: comprueba que el sistema desplegado responde y que su flujo principal funciona.
# Si algo falla, termina con código 1 (y el job de despliegue falla y revierte).
#
# Uso:
#   scripts/smoke-test.sh [version-esperada]
# Variables:
#   BASE_URL               por defecto http://localhost:${PUERTO_BACKEND:-3000}
#   COMPOSE_PROJECT_NAME   proyecto de Compose del que se leen los logs (el "correo" con el código)
#
# Flujo principal (Retos 1 y 3): un conductor ingresa con su correo institucional, registra su vehículo
# y programa un viaje; una pasajera ingresa, lo encuentra y solicita cupo; el conductor acepta y valida
# el QR. También comprueba que la API exige el token (401) y que nadie cancela un viaje ajeno (403).
# El código de ingreso se "envía" por consola: se lee de los logs del contenedor, como lo haría el
# estudiante en su correo. Por eso la prueba corre en la misma máquina del despliegue.
set -euo pipefail
cd "$(dirname "$0")/.."

BASE_URL="${BASE_URL:-http://localhost:${PUERTO_BACKEND:-3000}}"
VERSION_ESPERADA="${1:-}"
CONDUCTOR="humo.conductor@unisabana.edu.co"
PASAJERA="humo.pasajera@unisabana.edu.co"

falla() { echo "PRUEBA DE HUMO FALLIDA: $*" >&2; exit 1; }
ok() { echo "  ok  $*"; }
campo() { sed -nE "s/.*\"$1\":\"?([^\",}]*)\"?.*/\1/p" <<< "$2" | head -1; }
pedir() { # pedir <metodo> <ruta> [token] [cuerpo] -> imprime "<codigo-http> <cuerpo>"
  local args=(-s -X "$1" -H 'Content-Type: application/json' -w '\n%{http_code}')
  [[ -n "${3:-}" ]] && args+=(-H "Authorization: Bearer $3")
  [[ -n "${4:-}" ]] && args+=(-d "$4")
  local salida; salida="$(curl "${args[@]}" "$BASE_URL$2")" || falla "no hay conexión con $BASE_URL$2"
  echo "$(tail -n1 <<< "$salida") $(sed '$d' <<< "$salida")"
}
# Contenedor del backend del proyecto de Compose (se busca por sus etiquetas: así no hace falta el
# archivo .env ni SECRETO_TOKEN para leer los logs cuando la prueba se ejecuta a mano en el servidor).
PROYECTO="${COMPOSE_PROJECT_NAME:-wheels}"
contenedor() {
  docker ps -q --filter "label=com.docker.compose.project=$PROYECTO" --filter "label=com.docker.compose.service=backend" | head -1
}
ingresar() { # ingresar <correo> <rol> -> imprime el token
  pedir POST /auth/solicitar-codigo "" "{\"nombre\":\"Prueba de humo\",\"correo\":\"$1\",\"rol\":\"$2\"}" > /dev/null
  local codigo="" id; id="$(contenedor)"
  [[ -n "$id" ]] || falla "no hay un contenedor backend corriendo en el proyecto de Compose '$PROYECTO'"
  for _ in 1 2 3 4 5; do
    codigo="$(docker logs "$id" 2>&1 | grep "\[EMAIL a $1\]" | tail -1 | grep -oE '[0-9]{6}' | tail -1 || true)"
    [[ -n "$codigo" ]] && break
    sleep 1
  done
  [[ -n "$codigo" ]] || falla "no apareció el código de ingreso de $1 en los logs"
  local r; r="$(pedir POST /auth/verificar "" "{\"correo\":\"$1\",\"codigo\":\"$codigo\"}")"
  [[ "${r%% *}" == "200" ]] || falla "no se pudo verificar el código de $1: $r"
  campo token "$r"
}

echo "==> Prueba de humo contra $BASE_URL"

# 1. El servicio está arriba (se reintenta: el entorno puede estar terminando de arrancar).
salud="$(curl -fsS --retry 15 --retry-delay 2 --retry-all-errors "$BASE_URL/salud")" || falla "no responde $BASE_URL/salud"
[[ "$salud" == *'"estado":"ok"'* ]] || falla "/salud no está ok: $salud"
ok "salud: $salud"

# 2. Responde la versión que se acaba de desplegar.
if [[ -n "$VERSION_ESPERADA" ]]; then
  [[ "$salud" == *"\"version\":\"$VERSION_ESPERADA\""* ]] || falla "se esperaba la versión $VERSION_ESPERADA y responde $salud"
  ok "versión $VERSION_ESPERADA"
fi

# 3. La API exige el token de sesión.
r="$(pedir GET /viajes)"; [[ "${r%% *}" == "401" ]] || falla "sin token se esperaba 401 y respondió ${r%% *}"
ok "sin token responde 401"

# 4. Flujo principal.
TOKEN_C="$(ingresar "$CONDUCTOR" conductor)"; ok "ingreso del conductor (código leído de los logs)"
r="$(pedir PUT "/usuarios/$CONDUCTOR/vehiculo" "$TOKEN_C" '{"placa":"HUM123","descripcion":"Carro de la prueba de humo"}')"
[[ "${r%% *}" == "200" ]] || falla "no se pudo registrar el vehículo: $r"; ok "vehículo registrado"

MANANA="$(date -d '+1 day' +%F 2>/dev/null || date -v+1d +%F)"
r="$(pedir POST /viajes "$TOKEN_C" "{\"puntoInicio\":\"Prueba de humo\",\"puntoFinal\":\"Universidad\",\"fecha\":\"$MANANA\",\"hora\":\"06:00\",\"cuposDisponibles\":1}")"
[[ "${r%% *}" == "201" ]] || falla "no se pudo programar el viaje: $r"
VIAJE="$(campo id "$r")"; ok "viaje $VIAJE programado"

TOKEN_P="$(ingresar "$PASAJERA" pasajero)"; ok "ingreso de la pasajera"
r="$(pedir GET "/viajes?fecha=$MANANA&origen=Prueba" "$TOKEN_P")"
[[ "$r" == *"\"id\":$VIAJE,"* ]] || falla "la búsqueda no encuentra el viaje $VIAJE: $r"; ok "búsqueda encuentra el viaje"

r="$(pedir POST "/viajes/$VIAJE/reservar" "$TOKEN_P" '{"puntoRecogida":"Portería de la prueba de humo"}')"
[[ "${r%% *}" == "201" ]] || falla "no se pudo solicitar el cupo: $r"
RESERVA="$(campo id "$r")"; ok "cupo solicitado (reserva $RESERVA)"

r="$(pedir POST "/viajes/$VIAJE/cancelar" "$TOKEN_P")"
[[ "${r%% *}" == "403" ]] || falla "la pasajera pudo cancelar el viaje ajeno: $r"; ok "cancelar un viaje ajeno responde 403"

r="$(pedir POST "/reservas/$RESERVA/aceptar" "$TOKEN_C")"
[[ "${r%% *}" == "200" ]] || falla "el conductor no pudo aceptar la solicitud: $r"
QR="$(campo codigo "$r")"; ok "solicitud aceptada y QR generado"

r="$(pedir POST "/viajes/$VIAJE/abordar" "$TOKEN_C" "{\"codigo\":\"$QR\"}")"
[[ "$r" == *"Abordaje confirmado"* ]] || falla "no se pudo validar el QR: $r"; ok "QR validado: abordaje confirmado"

r="$(pedir POST "/viajes/$VIAJE/cancelar" "$TOKEN_C")"
[[ "${r%% *}" == "200" ]] || falla "el conductor no pudo cancelar su viaje: $r"; ok "viaje de prueba cancelado"

echo "==> Prueba de humo superada"
