package com.fusion.fusion.pendingchange;

import java.time.LocalDateTime;

public record PendingChangeResponse(

        Long id,

        String vehiclePlate,

        String fieldName,

        String oldValue,

        String newValue,

        String sourceImport,

        LocalDateTime detectedAt,

        String status

) {

    public static PendingChangeResponse from(PendingChange change) {

        return new PendingChangeResponse(
                change.getId(),
                change.getVehiclePlate(),
                change.getFieldName(),
                change.getOldValue(),
                change.getNewValue(),
                change.getSourceImport(),
                change.getDetectedAt(),
                change.getStatus()
        );

    }

}
