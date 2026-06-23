package com.fusion.fusion.signalcontrol;

import com.fusion.fusion.vehicle.OperationalStatus;
import com.fusion.fusion.vehicle.VehiclePlatform;

import java.time.LocalDateTime;

public record SignalControlResponse(

        String plate,

        String insuredName,

        VehiclePlatform platform,

        String lineNumber,

        LocalDateTime lastCommunicationAt,

        Integer signalDelayMinutes,

        OperationalStatus status,

        SignalStage suggestedStage,

        ObservationSummary lastObservation,

        CheckSummary lastCheck,

        Long activeLetterId,

        Long openMaintenanceId

) {

    public record ObservationSummary(

            Long id,

            String text,

            LocalDateTime createdAt,

            String createdBy

    ) {
    }

    public record CheckSummary(

            LocalDateTime checkedAt,

            String checkedBy

    ) {
    }

}
