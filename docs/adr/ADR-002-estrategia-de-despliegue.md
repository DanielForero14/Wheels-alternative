# ADR-002. Estrategia de despliegue continuo

**Estado:** aceptada (Corte 3)

## Contexto

En el Corte 2 WHEELS se ejecutaba a mano en el computador de un integrante (`npm start`) y en el taller de Docker se contenerizó el backend. En este corte cada versión que llega a `main` debe desplegarse sin pasos manuales en un entorno accesible, verificarse con una prueba de humo y con la prueba de carga del SLO (p95 ≤ 500 ms, errores < 1 %), y poder revertirse a la versión anterior.

Lo que hay que desplegar:

- **El backend** (API Express + SQLite con sql.js). Guarda la base de datos en un archivo, así que necesita un **disco que sobreviva** a los reinicios y a los despliegues.
- **La app móvil** (Expo) **no** se despliega en un servidor: corre en el celular de cada estudiante (Expo Go) y se conecta a la API. Igual que en el enunciado para los clientes de escritorio, lo que se contenieriza y despliega es el componente de servidor.

Restricciones: tres integrantes, sin presupuesto, con una máquina del equipo con Docker Desktop y WSL (la misma del taller DevSecOps) y un repositorio público en GitHub.

## Decisión

1. **Registro de imágenes:** GitHub Container Registry, imagen `ghcr.io/danielforero14/wheels-backend`. Cada imagen se publica con la etiqueta `sha-<commit>` (inmutable, es la que se despliega) y, cuando el push es un tag `vX.Y.Z`, también con `X.Y.Z`. Nunca se publica ni se despliega solo `latest`.
2. **Entorno:** la máquina del equipo con Docker Engine y Compose, con un **runner autohospedado** de GitHub Actions (`wheels-wsl`, etiqueta `wheels`) instalado como servicio en WSL. El sistema corre en el proyecto de Compose `wheels-produccion`, en el puerto 8091, separado del entorno de desarrollo (puerto 3000) y de otros proyectos de la máquina.
3. **Mecanismo:** el job `desplegar` de `cd.yml` ejecuta `scripts/deploy.sh`, que hace `docker compose pull` y `docker compose up -d --wait` con la imagen nueva. `--wait` falla si el contenedor no llega a *healthy* (`/salud`).
4. **Verificación:** después del despliegue corren `scripts/smoke-test.sh` (salud, versión desplegada, 401 sin token y el flujo principal: ingreso con código, vehículo, programar, buscar, solicitar cupo, aceptar, validar el QR, 403 al cancelar un viaje ajeno) y `scripts/slo.sh` (k6 con los umbrales del SLO). Si alguno falla, el pipeline falla.
5. **Reversión:** si la verificación falla, el mismo job ejecuta `scripts/rollback.sh`, que vuelve a desplegar la imagen anterior y repite la prueba de humo. También se puede revertir a mano desde la pestaña Actions (`workflow_dispatch` de CD con el tag de la imagen).
6. **Secretos:** `SECRETO_TOKEN` vive en el environment `produccion` de GitHub (Secrets); el puerto y la URL, en Variables. El environment solo acepta despliegues desde `main` y desde tags `v*.*.*`.
7. **Interruptor:** los jobs del runner solo corren si la variable del repositorio `DESPLIEGUE` vale `activo`, para que el pipeline no quede esperando un runner que no existe (por ejemplo, en un *fork*).

## Alternativas consideradas

| Alternativa | Por qué no se eligió |
|---|---|
| Render, Railway o Fly.io (plan gratuito) | Darían una URL pública, pero en el plan gratuito el disco no persiste: SQLite se borraría en cada despliegue o reinicio. Además el servicio se suspende por inactividad y la primera petición tarda casi un minuto. La prueba de humo tampoco podría leer el código de ingreso, que llega por la consola del contenedor |
| Cambiar SQLite por PostgreSQL gestionado para poder usar la nube | Es un cambio de arquitectura sin un reto que lo pida; las bases gratuitas expiran a los 30–90 días. Gracias al puerto `IRepositorioViajes` queda como un adaptador nuevo si el sistema crece (ver `evolucion.md`) |
| Azure for Students o AWS Academy | Requieren configurar redes, identidades y credenciales de nube; más tiempo de configuración que de aprendizaje del pipeline |
| Despliegue por SSH desde un runner de GitHub | Exige abrir el puerto SSH de la máquina a Internet y guardar una llave privada en Secrets. El runner autohospedado solo hace conexiones salientes hacia GitHub |
| Kubernetes (kind o minikube) | Es una bonificación opcional. Agrega manifiestos, probes y políticas sin que ningún reto lo pida |

## Consecuencias

- **Positivas:** el despliegue no cuesta nada, la base de datos persiste en un volumen de Docker y el entorno es el mismo que se usó en el taller. La prueba de humo puede recorrer el flujo real completo porque corre en la misma máquina.
- **Negativas:**
  - El entorno depende de que la máquina esté encendida. Si está apagada, el job de despliegue espera al runner (hasta 24 horas) y luego falla.
  - La URL (`http://localhost:8091`) solo es accesible desde esa máquina, o desde la red local con su IP. La rúbrica acepta como evidencia la ejecución del despliegue en GitHub Actions y la demostración en la presentación.
  - No hay HTTPS: para producción real hace falta un *proxy* inverso con certificado (ver `implementacion.md`).
  - El runner ejecuta código del repositorio en esa máquina. Por eso solo lo usan los jobs de `main`, de los tags y de la reversión manual; los Pull Requests corren en runners de GitHub (amenaza A12 en `seguridad.md`).
- **Despliegue con interrupción corta:** mientras se recrea el contenedor (unos segundos) la API no responde. No hay despliegue azul-verde porque SQLite no admite dos procesos escribiendo el mismo archivo.
- **Datos de prueba en producción:** la prueba de humo y la de carga crean usuarios de prueba (`humo.*@unisabana.edu.co`) y viajes que cancelan al terminar. Con dos entornos (pruebas y producción) correrían contra el de pruebas.
