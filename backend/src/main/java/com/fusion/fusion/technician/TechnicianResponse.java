package com.fusion.fusion.technician;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public record TechnicianResponse(
        UUID id,
        String name,
        String phone,
        String address,
        String city,
        String state,
        String zipCode,
        String neighborhood,
        Double latitude,
        Double longitude,
        BigDecimal defaultServiceValue,
        Boolean active,
        LocalDateTime createdAt
) {}
