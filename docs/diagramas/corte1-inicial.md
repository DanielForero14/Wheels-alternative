# Arquitectura inicial (Corte 1)

```mermaid
flowchart LR
    App["App móvil<br/>(Expo)"] -->|HTTP / JSON| Server["server.js<br/>(rutas Express)"]
    Server --> Factory["ViajeFactory"]
    Server --> Gestor["GestorViajes<br/>(lista en memoria)"]
    Gestor --> INot["INotificador"]
    INot --> Consola["ConsolaNotificador"]
    INot --> AppN["AppNotificador"]
```

Explicación completa en [arquitectura.md](../arquitectura.md#4-arquitectura-inicial-corte-1-y-arquitectura-evolucionada-corte-2).
