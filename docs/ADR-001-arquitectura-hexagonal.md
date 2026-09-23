# ADR-001: Usar arquitectura hexagonal (puertos y adaptadores) en el backend

- **Estado:** Aceptada
- **Fecha:** septiembre de 2026
- **Autores:** equipo WHEELS

## Contexto

En el Corte 1 el backend de WHEELS quedó organizado por tipo de clase (`modelo/`, `factoria/`, `notificaciones/`), con los datos en memoria y un `server.js` que hacía de todo. Para el Corte 2 nos asignaron tres retos:

1. **Autenticación con QR:** validar que quien aborda es quien reservó (seguridad).
2. **Contacto de emergencia:** enviar una alerta que llegue aunque falle un canal (disponibilidad).
3. **Planeación de viajes:** programar viajes a futuro, guardarlos en una base de datos y buscarlos rápido (rendimiento y mantenibilidad).

Los tres retos tienen algo en común: la lógica del negocio (reservar, validar un código, activar una alerta) tiene que hablar con cosas externas que pueden cambiar: la base de datos, la librería que genera el QR y los canales de notificación. Si el negocio depende directamente de esas cosas, cada cambio externo nos obliga a tocar el negocio, y además no lo podemos probar sin base de datos ni red.

También hay que tener en cuenta el tamaño real del proyecto: es un solo backend pequeño, lo hacemos tres personas y se ejecuta en un solo servidor.

## Opciones consideradas

### Opción 1: Arquitectura en capas (presentación → negocio → datos)
- ✅ Es la más conocida y la más fácil de entender.
- ✅ Buen rendimiento: las llamadas van directo de una capa a la otra.
- ❌ La capa de negocio depende de la capa de datos. Cambiar de memoria a SQLite, o cambiar la librería de QR, obliga a modificar el negocio.
- ❌ Para probar el negocio hay que simular la capa de datos completa.

### Opción 2: Arquitectura hexagonal (puertos y adaptadores)
- ✅ El negocio queda en el centro y solo conoce interfaces (puertos). La BD, el QR y los canales son adaptadores intercambiables.
- ✅ Ya teníamos un puerto en el Corte 1: `INotificador`. El estilo continúa lo que ya hicimos en lugar de empezar de cero.
- ✅ Se puede probar el negocio con dobles de prueba (mocks) sin BD ni red.
- ❌ Hay más archivos e interfaces que en capas.

### Opción 3: Microservicios (viajes, autenticación y emergencias por separado)
- ✅ Si se cae un servicio, los demás siguen funcionando.
- ❌ Agrega llamadas de red entre servicios (más latencia y más puntos de falla).
- ❌ Obliga a desplegar, configurar y monitorear varios servicios.
- ❌ Es desproporcionado para un backend pequeño con un equipo de tres personas. Ningún reto exige escalar partes del sistema por separado.

La comparación con puntajes está en [arquitectura.md, sección 3](../arquitectura.md#3-comparación-de-estilos-y-decisión).

## Decisión

Adoptamos **arquitectura hexagonal** para el backend. En concreto:

- El **dominio** (`Viaje`, `Reserva`, `ContactoEmergencia`, `ViajeFactory`) y los **casos de uso** (`ServicioViajes`, `ServicioReservas`, `ServicioEmergencia`) no importan Express, SQLite ni ninguna librería externa.
- Definimos tres **puertos**:
  - `IRepositorioViajes`: guardar y buscar viajes y reservas (Reto 3).
  - `IGeneradorCodigo`: generar y verificar el código QR de una reserva (Reto 1).
  - `INotificador`: enviar avisos y alertas (Reto 2, ya existía).
- Los **adaptadores** implementan esos puertos: `RepositorioSQLite`, `RepositorioMemoria`, `GeneradorQR`, `ConsolaNotificador`, `AppNotificador` y `EmergenciaNotificador`.
- Las rutas de Express son un **adaptador de entrada** que solo llama a los casos de uso.
- `server.js` se encarga únicamente de conectar cada puerto con su adaptador y arrancar el servidor.

## Consecuencias

### Lo que ganamos
- **Mantenibilidad:** cambiar la BD, la librería de QR o agregar un canal (SMS, WhatsApp) es crear un adaptador nuevo, sin tocar el negocio.
- **Disponibilidad de las alertas:** como el caso de uso habla con una lista de `INotificador`, si un canal falla se intenta con el siguiente.
- **Seguridad:** la regla "el código es válido, es de este viaje y no se ha usado" vive en un solo lugar del núcleo y no se mezcla con el código de HTTP.
- **Facilidad para probar:** las pruebas unitarias usan dobles de prueba para los puertos, y las de integración prueban cada adaptador real (por ejemplo, SQLite en memoria).

### Lo que sacrificamos
- **Más archivos y más indirección:** para seguir un flujo hay que pasar por ruta → caso de uso → puerto → adaptador.
- **Curva de aprendizaje:** todo el equipo debe respetar la regla de dependencias (el núcleo nunca importa un adaptador). Si alguien la rompe, el estilo pierde sentido.
- **Rendimiento:** la capa extra de interfaces tiene un costo pequeño. No esperamos que sea el cuello de botella; lo vamos a comprobar con las pruebas de carga.
- **No da tolerancia a fallos entre servidores:** a diferencia de microservicios, si el servidor se cae, se cae todo. Lo aceptamos porque ninguno de los retos lo exige.
