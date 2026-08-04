package com.fusion.fusion.serviceorder;

import java.time.LocalDateTime;

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
        String observations
) {}
