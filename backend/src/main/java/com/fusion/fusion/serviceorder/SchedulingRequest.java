package com.fusion.fusion.serviceorder;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record SchedulingRequest(
        UUID technicianId,
        SchedulingStatus schedulingStatus,
        LocalDate scheduledDate,
        String scheduledTime,
        BigDecimal serviceValue,
        BigDecimal displacementValue,
        String observations,
        Double techLat,
        Double techLon,
        Double clientLat,
        Double clientLon
) {}
