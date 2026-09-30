# Diagrama de componentes de la API (C4 – nivel 3, estilo hexagonal)

```mermaid
flowchart LR
    subgraph ENTRADA["Adaptadores de entrada"]
        Rutas["Rutas HTTP<br/>(Express)"]
    end

    subgraph NUCLEO["Núcleo: no depende de nada externo"]
        direction TB
        subgraph APLICACION["Aplicación: casos de uso"]
            SU["ServicioUsuarios<br/>ingreso con código"]
            ST["ServicioTiempoEstimado<br/>caché + respaldo"]
            SV["ServicioViajes<br/>vehículo, programar, buscar, cancelar"]
            SR["ServicioReservas<br/>reservar, validar QR"]
            SE["ServicioEmergencia<br/>activar alerta"]
        end
        subgraph DOMINIO["Dominio"]
            D["Usuario · CodigoVerificacion<br/>Vehiculo · Viaje · Reserva<br/>ContactoEmergencia<br/>ViajeFactory"]
        end
        subgraph PUERTOS["Puertos (interfaces)"]
            PRepo["IRepositorioViajes"]
            PQR["IGeneradorCodigo"]
            PNot["INotificador"]
            PRut["IServicioRutas"]
        end
    end

    subgraph SALIDA["Adaptadores de salida"]
        Repos["RepositorioSQLite<br/>RepositorioMemoria"]
        QR["GeneradorCodigoQR"]
        Nots["ConsolaNotificador<br/>AppNotificador<br/>EmergenciaNotificador"]
        Rut["RutasOpenStreetMap<br/>RutasEstimadas"]
    end

    Rutas --> APLICACION
    APLICACION --> DOMINIO
    APLICACION --> PUERTOS
    Repos -. implementa .-> PRepo
    QR -. implementa .-> PQR
    Nots -. implementa .-> PNot
    Rut -. implementa .-> PRut
```

Explicación completa en [arquitectura.md](../arquitectura.md#4-arquitectura-inicial-corte-1-y-arquitectura-evolucionada-corte-2).
