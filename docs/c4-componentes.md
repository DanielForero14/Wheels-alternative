# Diagrama de componentes de la API (C4 – nivel 3, estilo hexagonal)

```mermaid
flowchart LR
    subgraph ENTRADA["Adaptadores de entrada"]
        Rutas["Rutas HTTP<br/>(Express)"]
    end

    subgraph NUCLEO["Núcleo: no depende de nada externo"]
        direction TB
        subgraph APLICACION["Aplicación: casos de uso"]
            SV["ServicioViajes<br/>crear, programar, buscar"]
            SR["ServicioReservas<br/>reservar, validar QR"]
            SE["ServicioEmergencia<br/>activar alerta"]
        end
        subgraph DOMINIO["Dominio"]
            D["Viaje · Reserva<br/>ContactoEmergencia<br/>ViajeFactory"]
        end
        subgraph PUERTOS["Puertos (interfaces)"]
            PRepo["IRepositorioViajes"]
            PQR["IGeneradorCodigo"]
            PNot["INotificador"]
        end
    end

    subgraph SALIDA["Adaptadores de salida"]
        Repos["RepositorioSQLite<br/>RepositorioMemoria"]
        QR["GeneradorQR"]
        Nots["ConsolaNotificador<br/>AppNotificador<br/>EmergenciaNotificador"]
    end

    Rutas --> APLICACION
    APLICACION --> DOMINIO
    APLICACION --> PUERTOS
    Repos -. implementa .-> PRepo
    QR -. implementa .-> PQR
    Nots -. implementa .-> PNot
```

Explicación completa en [arquitectura.md](../arquitectura.md#4-arquitectura-inicial-corte-1-y-arquitectura-evolucionada-corte-2).
