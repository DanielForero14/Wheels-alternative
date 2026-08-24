# Proyecto de Diseño de Software – Corte Uno
## WHEELS – Transporte Universitario

## 1. Presentación del Problema

Muchos estudiantes universitarios que no tienen carro propio dependen de
compañeros que sí lo tienen para movilizarse hacia y desde el campus. Sin
embargo, la oferta de estos servicios está **dispersa y desorganizada**:
se coordina por grupos de WhatsApp, carteleras físicas o de boca en boca,
sin un lugar centralizado donde ver qué viajes hay disponibles, a qué
hora, con cuántos cupos y hacia dónde. Esto genera incertidumbre, viajes
perdidos y falta de confianza entre conductores y pasajeros.

**WHEELS** centraliza esta información: los conductores publican sus
viajes (ruta, hora, cupos disponibles) y los pasajeros pueden verlos y
reservar un cupo, sin depender de mensajes sueltos y desorganizados.

Resolverlo con software permite **automatizar** lo que hoy se hace
manualmente: publicar un viaje, ver cupos en tiempo real, evitar que
alguien reserve un cupo que ya no existe, y notificar automáticamente a
conductor y pasajero cuando algo cambia — algo que un chat de WhatsApp no
puede garantizar.

**Alcance de este módulo (Corte 1):** el sistema gestiona la creación,
listado, reserva y cancelación de viajes universitarios, con notificación
automática a los involucrados. Queda **fuera de alcance** en este corte:
autenticación real de usuarios, persistencia en base de datos (se usa
almacenamiento en memoria), pagos, geolocalización en tiempo real y
calificación de usuarios.

## 2. Creatividad en la Presentación

🎥 `[pendiente – enlace al video/recurso creativo]`

## 3. Fundamentos de Ingeniería de Software

| Atributo de calidad | ¿Cómo se sostiene? | ¿Qué se sacrificó a cambio? |
|---|---|---|
| Mantenibilidad | `INotificador` aísla a `GestorViajes` del mecanismo de notificación (email, push). Agregar un canal nuevo (ej. SMS) no requiere tocar `GestorViajes`, solo crear una clase que implemente `INotificador` | Una capa extra de indirección: para entender qué notificación llega realmente hay que seguir la cadena `GestorViajes → INotificador → implementación concreta` |
| Extensibilidad | Nuevos tipos de viaje o reglas de negocio se pueden agregar en `ViajeFactory` sin modificar el código que ya crea viajes, siempre que se mantenga el mismo contrato | La validación de datos vive centralizada en la fábrica; si en el futuro cada tipo de viaje necesita validaciones distintas, la fábrica tendría que crecer con condicionales o dividirse en varias fábricas |

> Nota de honestidad técnica: no afirmamos que `INotificador` sea "reutilizable en otros proyectos" — no hay evidencia de eso. Lo que sí está demostrado con el código y las pruebas de ejecución es que es **extensible dentro de este sistema**: se agregaron dos notificadores (`ConsolaNotificador` y `AppNotificador`) sin modificar `GestorViajes`.

## 4. Diseño de Software

### 4.1 Principios SOLID aplicados

**SRP (Single Responsibility Principle) — con evidencia antes/después:**

```javascript
// ❌ ANTES: GestorViajes mezclaría la gestión de viajes CON el envío de notificaciones
class GestorViajes {
    reservarViaje(id) {
        const viaje = this.viajes.find(v => v.id === id);
        viaje.reservarCupo();
        // lógica de envío de email/push mezclada aquí mismo
        console.log(`Enviando email a ${viaje.conductorId}...`);
    }
}
// Problema: cambiar de "console.log" a un proveedor real de correo (o agregar
// push) obligaría a modificar GestorViajes, aunque su responsabilidad es
// gestionar viajes, no enviar notificaciones.

// ✅ DESPUÉS (código real del proyecto): responsabilidades separadas
class GestorViajes {
    reservarViaje(id) {
        const viaje = this.viajes.find(v => v.id === id);
        viaje.reservarCupo();
        this._notificarTodos(viaje, `Se reservó un cupo. Cupos restantes: ${viaje.cuposDisponibles}`);
        return viaje;
    }
    _notificarTodos(viaje, mensaje) {
        this.observadores.forEach(obs => obs.notificar(viaje, mensaje));
    }
}
// GestorViajes ya no conoce el mecanismo de notificación. Cambiar de
// consola a un servicio real de email no toca esta clase.
```

**OCP (Open/Closed Principle):** agregar un canal de notificación nuevo (SMS, WhatsApp) se hace creando una clase que implemente `INotificador`, sin modificar `GestorViajes` — ver `ConsolaNotificador.js` y `AppNotificador.js`, ambas implementaciones intercambiables.

**DIP (Dependency Inversion Principle):** `GestorViajes` depende de la abstracción `INotificador`, no de una implementación concreta. Las instancias concretas (`ConsolaNotificador`, `AppNotificador`) se inyectan desde `server.js` con `gestor.agregarObservador(...)`, no se crean dentro de `GestorViajes`.

### 4.2 Patrones de diseño utilizados

| Patrón | Categoría | Problema que resuelve aquí | Alternativa descartada y por qué |
|---|---|---|---|
| **Factory Method** (`ViajeFactory`) | Creacional | Centraliza la creación de `Viaje`: genera el ID y valida los datos obligatorios, sin que las rutas de `server.js` conozcan esos detalles | Se descartó Builder: `Viaje` no se construye por pasos opcionales, solo necesita validar y ensamblar datos que ya llegan completos |
| **Observer** (`GestorViajes` como *Subject*, `INotificador` como *Observer*) | Comportamiento | `GestorViajes` mantiene una lista de `INotificador` y les avisa cuando un viaje cambia de estado (reserva, cupo lleno, cancelación), sin conocer sus tipos concretos | Se descartó un Event Bus con colas (pub/sub asíncrono): el volumen de eventos es bajo para un solo servidor local, no justifica esa complejidad |

### 4.3 Modelado UML

```mermaid
classDiagram
    class Viaje {
        -int id
        -int conductorId
        -String puntoInicio
        -String puntoFinal
        -String hora
        -int cuposDisponibles
        -String estado
        +reservarCupo()
        +cancelar()
    }
    class ViajeFactory {
        +crearViaje(datos) Viaje
    }
    class GestorViajes {
        -List~Viaje~ viajes
        -List~INotificador~ observadores
        +agregarObservador(INotificador o)
        +agregarViaje(Viaje v)
        +reservarViaje(id)
        +cancelarViaje(id)
        -_notificarTodos(viaje, mensaje)
    }
    class INotificador {
        <<interface>>
        +notificar(viaje, mensaje)
    }
    class ConsolaNotificador
    class AppNotificador

    ViajeFactory ..> Viaje : crea
    GestorViajes o-- INotificador : observa
    GestorViajes --> Viaje : gestiona
    INotificador <|.. ConsolaNotificador
    INotificador <|.. AppNotificador
```

**Tabla de trazabilidad:**

| Clase en el diagrama | Archivo | Coincide |
|---|---|---|
| `Viaje` | `/backend/src/modelo/Viaje.js` | Sí |
| `ViajeFactory` | `/backend/src/factoria/ViajeFactory.js` | Sí |
| `GestorViajes` | `/backend/src/modelo/GestorViajes.js` | Sí |
| `INotificador` | `/backend/src/notificaciones/INotificador.js` | Sí |
| `ConsolaNotificador` | `/backend/src/notificaciones/ConsolaNotificador.js` | Sí |
| `AppNotificador` | `/backend/src/notificaciones/AppNotificador.js` | Sí |

## 5. Implementación

- `/backend/src/modelo`: `Viaje` (entidad), `GestorViajes` (lógica de negocio y Subject del Observer).
- `/backend/src/notificaciones`: `INotificador` (interfaz), `ConsolaNotificador`, `AppNotificador` (implementaciones concretas).
- `/backend/src/factoria`: `ViajeFactory` (Factory Method).
- `/backend/src/server.js`: arma las dependencias (inyección de `INotificador` en `GestorViajes`) y expone la API REST.
- `/mobile`: app en Expo/React Native (interfaz para conductores y pasajeros).

**Instrucciones de ejecución (backend):**
```bash
cd backend
npm install
npm start
```
Servidor disponible en `http://localhost:3000`. Endpoints: `POST /viajes`, `GET /viajes`, `POST /viajes/:id/reservar`, `POST /viajes/:id/cancelar`.

**Instrucciones de ejecución (app móvil):**
```bash
cd mobile
npm install
npx expo start
```
Escanea el QR con la app Expo Go.

## 6. Análisis Técnico

- **Alta cohesión:** `GestorViajes` solo gestiona el ciclo de vida de los viajes (crear, reservar, cancelar); no contiene lógica de envío de notificaciones ni de validación de datos de entrada (eso vive en `ViajeFactory`).
- **Bajo acoplamiento:** comprobado en que `GestorViajes` puede probarse con un `INotificador` de prueba (mock) sin necesidad de un servicio real de correo o push — se verificó en las pruebas manuales con `ConsolaNotificador` y `AppNotificador` corriendo en paralelo sin conflicto.
- **Límite honesto del diseño:** el sistema actual no persiste datos (se pierden al reiniciar el servidor) ni valida duplicados de reserva por el mismo usuario; agregar eso requeriría un patrón Repository y un modelo de usuario, fuera del alcance de este corte.

## 7. Créditos y Roles

| Integrante | Rol / contribución |
|---|---|
| Gabriel Armando González Sosa | *(pendiente)* |
| Daniel Felipe Forero Sánchez | *(pendiente)* |
| Integrante 3 | *(pendiente)* |