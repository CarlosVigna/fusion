package com.fusion.fusion.serviceorder;

import java.time.LocalDateTime;
import java.util.UUID;

public record ServiceOrderRequest(
        String requestedBy,
        LocalDateTime requestedAt,
        String plate,
        String chassis,
        String equipment,
        ServiceType serviceType,
        String city,
        String address,
        String neighborhood,
        String state,
        String zipCode,
        String customerName,
        String customerPhone,
        String observations,
        // So' usado em create() — update() continua sem atribuir
        // tecnico (isso e' feito via PUT /{id}/scheduling, que ja' tem
        // sua propria logica de calculo de deslocamento).
        UUID technicianId
) {}
