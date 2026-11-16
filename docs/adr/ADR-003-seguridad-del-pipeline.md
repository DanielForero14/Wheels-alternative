# ADR-003. Estrategia de seguridad del pipeline

**Estado:** aceptada (Corte 3)

## Contexto

En el Corte 2 la seguridad de WHEELS dependía de que alguien revisara el código a mano: nada impedía que entrara una dependencia con una vulnerabilidad conocida, una clave escrita en un archivo o una imagen con paquetes del sistema operativo vulnerables. Además, el modelo de amenazas de este corte (ver [seguridad.md](../seguridad.md)) encontró que el backend no autenticaba las peticiones: confiaba en el correo que enviaba la app.

El enunciado pide cuatro controles como *quality gates* (análisis estático, dependencias, secretos e imagen), con umbrales mínimos que cada grupo puede endurecer pero no relajar. El sistema tiene dos partes con dependencias distintas: el backend (Node.js, el que se despliega en la imagen) y la app móvil (Expo, que corre en el celular).

Restricciones del equipo: tres integrantes, sin presupuesto para herramientas de pago, repositorio público en GitHub y un pipeline de integración que debe tardar menos de 10 minutos.

## Decisión

1. **Autenticación y autorización en la API** (mitigación de A1, A2, A3, A4 y A5): token de sesión firmado con HMAC-SHA256 (`node:crypto`, sin dependencias nuevas) que se entrega al verificar el correo; el usuario sale del token; reglas de autorización en los casos de uso (403); bloqueo del código de ingreso al quinto intento fallido.
2. **Cuatro controles en `ci.yml`, cada uno en su propio job** (un check por control en el Pull Request), con los scripts de `scripts/` que también se pueden correr a mano con Docker:

| Control | Herramienta | Umbral | Enunciado | Por qué este valor |
|---|---|---|---|---|
| SAST | CodeQL (`javascript-typescript`, consultas `security-extended`) + `scripts/umbral-sast.sh` | Ningún hallazgo con *security-severity* ≥ 7.0 sin tratar | Ninguno alto o crítico sin tratar | Igual al mínimo en severidad, pero **más estricto en alcance**: `security-extended` agrega consultas que el conjunto por defecto no incluye |
| SCA | Trivy 0.76.0 `fs` sobre los dos `package-lock.json` | Ninguna HIGH o CRITICAL con corrección disponible | Igual | Revisa también la app móvil, aunque no se despliega en el servidor, porque se distribuye a los estudiantes |
| Secretos | Gitleaks 8.30.1 sobre todo el historial | Cero secretos | Igual | Es el único umbral razonable: un secreto expuesto ya no se puede "medio corregir" |
| Imagen | Trivy 0.76.0 `image` sobre `wheels-backend` | Ninguna CRITICAL con corrección disponible | Igual | La imagen base es `node:24.22.2-bookworm-slim` con versión fija; Dependabot propone las actualizaciones |

3. **Tratamiento de lo que no se corrige:** cada excepción (`.trivyignore` o `.github/codeql/excepciones-sast.txt`) debe tener su registro en `docs/seguridad.md` como *falso positivo* o *riesgo aceptado*, con lo que haría falta para corregirla.
4. **Endurecimiento del contenedor:** usuario sin privilegios (`node`), sistema de archivos de solo lectura salvo el volumen de datos, `cap_drop: ALL` y `no-new-privileges`.
5. **Dependabot** para npm (backend y app), Docker y GitHub Actions. No reemplaza al control de SCA.

## Alternativas consideradas

| Alternativa | Por qué no se eligió |
|---|---|
| JWT con la librería `jsonwebtoken` | Agrega una dependencia (y su superficie de vulnerabilidades) para algo que `node:crypto` resuelve en 40 líneas con el mismo algoritmo (HS256). Si el sistema necesitara tokens de un proveedor externo (OIDC), sí convendría una librería |
| Contraseñas en lugar del código por correo | Obliga a guardar contraseñas (hash, recuperación, fugas). El código por correo institucional ya prueba que el estudiante es de La Sabana, que es lo que pide el Reto 1 |
| SonarCloud o Semgrep para SAST | SonarCloud exige crear y conectar una cuenta externa; Semgrep es buena opción, pero CodeQL ya viene integrado en GitHub, publica en la pestaña *Security* y es el que se usó en el taller |
| `npm audit` como SCA | Solo revisa npm, depende de la red del registro y no tiene un formato de excepciones documentado por identificador. Trivy revisa las dos carpetas y es la misma herramienta del escaneo de imagen |
| OWASP Dependency-Check | Mucho más lento (descarga la base del NVD en cada ejecución) y con más falsos positivos en proyectos de JavaScript |
| TruffleHog para secretos | Equivalente a Gitleaks; se eligió Gitleaks porque es el del taller y su reporte con `--redact` no expone los valores |
| Grype para la imagen | Equivalente; usar Trivy para SCA y para la imagen deja una sola herramienta y una sola forma de registrar excepciones |
| Umbral HIGH también para la imagen | La imagen `bookworm-slim` suele tener vulnerabilidades altas del sistema operativo sin corrección publicada todavía; bloquear por ellas dejaría el pipeline en rojo sin que el equipo pueda hacer nada. Se mantiene el mínimo del enunciado (CRITICAL con corrección) |
| *Rate limiting* en la API | Se dejó como riesgo aceptado (H-09): la amenaza principal que cubre (fuerza bruta del código) ya está mitigada por el bloqueo de intentos, y en producción lo resuelve mejor un *proxy* inverso que la propia API |

## Consecuencias

- **Positivas:** ningún cambio llega a `main` con una vulnerabilidad conocida corregible, un secreto o una violación de las reglas de autorización probadas. Los controles corren en paralelo y la integración completa sigue por debajo de los 10 minutos.
- **Costos:** el job de CodeQL es el más lento (análisis de todo el código). La app móvil tiene dos riesgos aceptados (H-02 y H-03) que solo se cierran migrando de versión de Expo; quedan visibles en `.trivyignore` y en `seguridad.md`.
- **Lo que no cubre:** análisis dinámico de la API desplegada (DAST, bonificación opcional), bitácora de auditoría (H-08) y límite de peticiones (H-09). El token vive 12 horas y no se puede revocar antes, salvo cambiando `SECRETO_TOKEN` (lo que cierra todas las sesiones).
- **Operación:** `SECRETO_TOKEN` se guarda en GitHub Secrets (environment de producción) y en el `.env` del servidor; la guía de implementación explica cómo generarla y rotarla.
