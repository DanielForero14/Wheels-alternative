# Estrategia y resultados de pruebas – WHEELS (Corte 2)

Las pruebas cumplen dos funciones: comprobar que el sistema funciona y **demostrar que los retos se atienden**. Cada nivel prueba una parte distinta de la arquitectura hexagonal.

Usamos el ejecutor de pruebas que ya trae Node (`node:test` y `node:assert`), así no hay que instalar Jest ni otra librería. Los comandos están en el [README](../README.md#2-cómo-ejecutar-las-pruebas).

---

## 1. Pruebas unitarias (`backend/tests/unitarias/`)

**Qué prueban:** las reglas del **dominio** (`Usuario`, `CodigoVerificacion`, `Viaje`, `ViajeFactory`, `Reserva`, `ContactoEmergencia`) y los **casos de uso** (`ServicioUsuarios`, `ServicioViajes`, `ServicioReservas`, `ServicioEmergencia`, `ServicioTiempoEstimado`).

**Cómo:**
- Sin base de datos, sin red y sin Express.
- Patrón **AAA** (Arrange – Act – Assert) y nombres que dicen qué se espera.
- **Dobles de prueba** para los puertos:
  - `RepositorioMemoria` como repositorio falso.
  - Un generador de códigos falso (devuelve `codigo-1`, `codigo-2`, …) en lugar de la librería de QR.
  - Notificadores espía (`mock.fn()`) para comprobar a quién se avisó, y canales que lanzan error para simular un SMS caído.

**Clases de equivalencia y valores límite:**

| Regla | Válidos | Inválidos / límite |
|---|---|---|
| Correo de ingreso | `ana@unisabana.edu.co`, en mayúsculas o con espacios | `@gmail.com`, sin arroba, sin usuario, `ana@unisabana.edu.co.falso.com`, `ana@falsounisabana.edu.co` |
| Código de verificación del correo | correcto, justo al minuto 10 (límite) | distinto, 1 ms después del minuto 10, ya usado |
| Rol | pasajero, conductor | `admin`; un pasajero que intenta programar un viaje |
| Caché del tiempo estimado (5 min) | 1 ms antes de vencer (límite): sale del caché; 5 consultas simultáneas: 1 sola llamada al servicio | 1 ms después de vencer: se recalcula |
| Ubicación de origen | coordenadas válidas; dos puntos a menos de 100 m comparten caché | latitud con letras, latitud 91, longitud 181, sin datos |
| Servicio de mapas | responde | caído: responde el respaldo |
| Cupos de un viaje | 1 y 6 (límites) | 0, 7, 2.5, "tres" |
| Fecha del viaje | hoy (límite) y días futuros | ayer, formato `05/10/2026` |
| Hora del viaje | `07:00` | `7am` |
| Vencimiento del QR | justo en el momento en que vence (límite) | 1 ms después de vencer |
| Uso del QR | primera vez | segunda vez, código inventado, código de otro viaje |
| Teléfono de emergencia | 7 y 15 dígitos (límites) | 6 dígitos, 16 dígitos, con letras |
| Solicitud de cupo | punto de recogida de 5 y 150 caracteres (límites); nueva solicitud después de un rechazo | 4 o 151 caracteres; segunda solicitud pendiente al mismo viaje; sin pasajero; pasajero sin verificar |
| Respuesta del conductor | el conductor del viaje acepta o rechaza una solicitud pendiente | otro conductor; responder dos veces; aceptar cuando ya no hay cupos |
| Descripción de la ruta | hasta 200 caracteres (límite) | 201 caracteres |

**Cobertura:** se mide con `npm run test:cobertura`. Lo que interesa es la cobertura del núcleo (`dominio/` y `aplicacion/`).

---

## 2. Pruebas de integración (`backend/tests/integracion/`)

Revisan las **fronteras del estilo hexagonal**: que cada adaptador real cumpla su puerto, y que todo el sistema funcione junto.

| Archivo | Frontera que prueba | Infraestructura real |
|---|---|---|
| `repositorioSQLite.test.js` | Puerto `IRepositorioViajes` ↔ adaptador `RepositorioSQLite` | SQLite (sql.js) en memoria y en archivo |
| `generadorCodigoQR.test.js` | Puerto `IGeneradorCodigo` ↔ adaptador `GeneradorCodigoQR` | Librería `qrcode` y `crypto` |
| `rutasEstimadas.test.js` | Puerto `IServicioRutas` ↔ adaptador de respaldo `RutasEstimadas` | Cálculo de distancia real (Haversine) |
| `api.test.js` | Adaptador HTTP ↔ casos de uso ↔ SQLite ↔ QR (**caja negra**) | API Express real en un puerto libre, llamada con `fetch` |

**Flujos de sistema de extremo a extremo** (`api.test.js`), usados solo por HTTP:
- **Ingreso:** pedir código → leerlo del correo simulado → verificarlo. Un correo `@gmail.com` y un código incorrecto responden 400. Sin verificar no se puede programar un viaje.
- **Reto 3:** programar un viaje → encontrarlo en la búsqueda. Un viaje en fecha pasada responde 400.
- **Reto 1:** solicitar cupo con punto de recogida (queda pendiente) → el conductor lo ve en sus solicitudes y lo acepta → recibir el QR → verlo en "mis reservas" → abordar (200) → intentar abordar otra vez con el mismo QR (400). Un código inventado responde 400. Una solicitud rechazada no tiene QR y otro conductor no puede responderla. La descripción de por dónde pasa el viaje se ve en la búsqueda.
- **Reto 3 (tiempo estimado):** pedir el tiempo desde una ubicación → la segunda vez sale del caché. Con el servicio de mapas caído, responde el respaldo. Una ubicación inválida responde 400.
- **Reto 2:** la alerta lleva el link con la ubicación del usuario. Registrar y consultar el contacto → enviar alerta por SMS. El botón de pánico funciona sin viaje activo. Con el SMS caído, la alerta sale por el canal de respaldo. Sin contacto, responde 400.
- Un viaje sin cupos deja de aparecer en la búsqueda.

**Reproducibles y aisladas:** cada prueba crea su propia base de datos y su propia API, así que no comparten datos ni dependen del orden.

---

## 3. Pruebas de carga (`perf/`)

La API se arranca con `npm run start:carga`, que carga en memoria un conductor verificado y 500 viajes en los próximos 7 días.

**SLO definido antes de ejecutar:** p95 ≤ 500 ms y tasa de error < 1 %. Está escrito como `thresholds` en cada script, así que k6 marca solo si se cumple o no.

| Script | Tipo | Reto | Escenario |
|---|---|---|---|
| `busqueda-baseline.js` | Baseline | 3 – Planeación | 10 usuarios buscando viajes durante 1 minuto |
| `busqueda-carga.js` | Carga | 3 – Planeación | Sube hasta 200 usuarios buscando al tiempo (semana de parciales), 3 minutos |
| `emergencia-pico.js` | Pico | 2 – Emergencia | De 0 a 100 usuarios enviando alertas en 10 segundos |
| `tiempo-estimado.js` | Carga (sin caché vs. con caché) | 3 – Tiempo estimado | 50 usuarios pidiendo el tiempo hasta la universidad desde 5 puntos de salida, durante 1 minuto. La API usa un servicio de mapas simulado que tarda 300 ms, como uno real por internet |

Los reportes se guardan en `perf/resultados/`.

---

## Resultados

> Resultados de la ejecución en un computador del equipo (Windows, Node 22.19).

### Unitarias e integración

| Comando | Pruebas | Pasan | Fallan |
|---|---|---|---|
| `npm test` (primera ejecución, antes del tiempo estimado) | 97 (13 grupos) | 97 | 0 |
| `npm test` (con el tiempo estimado del Reto 3) | 121 (15 grupos) | 121 | 0 |
| `npm test` (versión final, con solicitudes de cupo y por dónde pasa) | 136 (15 grupos) | 136 | 0 |

Todas las pruebas se ejecutan con un solo comando (`npm test`) y tardan menos de 10 segundos.

### Cobertura del núcleo

Resultado de `npm run test:cobertura` (cobertura del proyecto completo: 97.73 % de líneas y 97.28 % de ramas).

| Archivo | % líneas | % ramas | % funciones |
|---|---|---|---|
| `dominio/Usuario.js` | 100 | 91.67 | 100 |
| `dominio/CodigoVerificacion.js` | 100 | 100 | 100 |
| `dominio/Viaje.js` | 100 | 100 | 100 |
| `dominio/ViajeFactory.js` | 100 | 100 | 100 |
| `dominio/Reserva.js` | 100 | 100 | 100 |
| `dominio/ContactoEmergencia.js` | 100 | 100 | 100 |
| `aplicacion/ServicioUsuarios.js` | 100 | 92.31 | 100 |
| `aplicacion/ServicioViajes.js` | 100 | 100 | 100 |
| `aplicacion/ServicioReservas.js` | 97.37 | 95.00 | 100 |
| `aplicacion/ServicioEmergencia.js` | 96.23 | 93.33 | 100 |

**Qué no está cubierto y por qué:**
- `ServicioReservas.js` y `ServicioEmergencia.js`: falta el caso en que se reserva o se activa una alerta con un viaje que no existe. Es un caso de error sencillo que queda pendiente de agregar.
- `puertos/`: aparecen con cobertura baja porque son interfaces. Sus métodos solo lanzan "no implementado" y nunca se llaman directamente; lo que se prueba son los adaptadores que los implementan.
- `datosDePrueba.js`: solo se usa al arrancar la API para las pruebas de carga (`npm run start:carga`), no en las pruebas unitarias ni de integración.

### Carga

Ejecutadas con k6 2.2 contra la API en modo `start:carga` (500 viajes en memoria), en el mismo computador. SLO definido antes de ejecutar: **p95 ≤ 500 ms y tasa de error < 1 %**.

| Prueba | Reto | Usuarios | Peticiones | p95 | Promedio | Máximo | Throughput | Tasa de error | ¿Cumple el SLO? |
|---|---|---|---|---|---|---|---|---|---|
| Búsqueda – baseline | 3 | 10 | 600 | 10.04 ms | 4.32 ms | 61.18 ms | 9.9 pet/s | 0 % | Sí |
| Búsqueda – carga | 3 | hasta 200 | 23.231 | 10.16 ms | 3.43 ms | 112.76 ms | 128.5 pet/s | 0 % | Sí |
| Emergencia – pico | 2 | 0 → 100 en 10 s | 4.034 alertas | 7.05 ms | 3.16 ms | 416.97 ms | 78.7 alertas/s | 0 % (100 % enviadas) | Sí |
| Tiempo estimado – **sin caché** | 3 | 50 | 1.872 | 639.92 ms | 620.59 ms | 684.19 ms | 30.4 pet/s | 0 % | **No** |
| Tiempo estimado – **con caché** | 3 | 50 | 3.000 | 17.17 ms | 13.6 ms | 645.95 ms | 49.2 pet/s | 0 % | Sí |

Los reportes completos están en `perf/resultados/` (archivos `.json` que genera k6).

### Análisis del cuello de botella

**Lo que muestran los números**

- **El caché es lo que hace cumplir el Reto 3.** Con el mismo servicio de mapas lento (300 ms por consulta), sin caché cada petición espera al servicio externo y el p95 es de 640 ms: **no cumple** el SLO. Con caché el p95 baja a **17 ms** (unas 37 veces menos) y el servidor atiende 49 peticiones por segundo en vez de 30, porque los usuarios ya no se quedan esperando. El máximo de 646 ms con caché corresponde a las primeras consultas, cuando el caché todavía está vacío.

- **La búsqueda escala bien en este rango.** Al pasar de 10 a 200 usuarios el p95 casi no cambia (10.04 ms → 10.16 ms), aunque el throughput subió 13 veces. Con esta carga el servidor todavía no está cerca de su límite.
- **El botón de pánico aguanta el pico.** Las 4.034 alertas llegaron a su contacto (100 % de checks exitosos), con p95 de 7 ms. Ninguna quedó sin enviar, que es lo que exige el Reto 2.
- **Los máximos son mucho más altos que el p95** (113 ms en la carga y 417 ms en el pico). Son pocos casos aislados, justo cuando los usuarios suben de golpe.

**Dónde está el cuello de botella**

0. **El servicio externo de mapas (Reto 3).** Es la parte más lenta del sistema: cada consulta tarda cientos de milisegundos y no depende de nosotros. Por eso se mitiga con caché (medido arriba) y con el respaldo `RutasEstimadas` si el servicio no responde.
1. **Node.js atiende todo en un solo hilo.** Cada búsqueda recorre la tabla de viajes con `LIKE` y convierte el resultado a JSON. Mientras hace eso no atiende otra petición, y por eso aparecen los picos aislados cuando llegan muchas peticiones al mismo tiempo. Con más usuarios, este es el primer límite que se alcanzaría.
2. **Los mensajes en consola.** Cada alerta de emergencia imprime una línea (`[SMS a ...]`). Escribir en la consola de Windows es lento y bloquea el hilo por un momento, y eso explica en buena parte el máximo de 417 ms en el pico de alertas.
3. **La escritura en archivo de SQLite (no medida aquí).** Las pruebas usaron la base en memoria. Con el archivo `wheels.db`, cada escritura (reservar, registrar un contacto) vuelve a guardar el archivo completo. Con muchas reservas al mismo tiempo, ese sería el cuello de botella más fuerte.

**Qué ofrece la arquitectura para mitigarlo (y qué no)**

- Como la base de datos está detrás del puerto `IRepositorioViajes`, se puede cambiar SQLite por una base de servidor (por ejemplo PostgreSQL, con índices por origen y destino) escribiendo **solo un adaptador nuevo**, sin tocar el dominio ni los casos de uso.
- Como los canales de alerta están detrás de `INotificador`, se puede reemplazar la consola por un canal real que envíe en segundo plano (por ejemplo, una cola de mensajes) sin cambiar `ServicioEmergencia`.
- **Lo que la arquitectura no resuelve:** hay un solo servidor. Si se cae o se satura, se cae todo, incluidas las alertas. Escalar a varios servidores exige una base de datos compartida y un balanceador; lo dejamos reconocido como límite en el ADR y en `arquitectura.md`.

**Límites de estas mediciones**

- k6 y la API corrieron en el mismo computador, así que compiten por el procesador. En un servidor real los números serían parecidos o mejores.
- Las pruebas usaron la base en memoria; el costo de guardar en archivo no está medido.
