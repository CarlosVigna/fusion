package com.fusion.fusion.vehicle.portal;

import java.time.LocalDateTime;

public record VehiclePortalDiffResponse(
        Long id,
        String plate,
        String field,
        String currentValue,
        String newValue,
        LocalDateTime detectedAt,
        LocalDateTime acceptedAt,
        LocalDateTime rejectedAt
) {

    public static VehiclePortalDiffResponse from(VehiclePortalDiff diff) {
        return new VehiclePortalDiffResponse(
                diff.getId(),
                diff.getPlate(),
                diff.getField(),
                diff.getCurrentValue(),
                diff.getNewValue(),
                diff.getDetectedAt(),
                diff.getAcceptedAt(),
                diff.getRejectedAt()
        );
    }

}
