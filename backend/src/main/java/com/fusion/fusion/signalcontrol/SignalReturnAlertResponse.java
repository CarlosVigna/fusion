package com.fusion.fusion.signalcontrol;

import com.fusion.fusion.observation.VehicleObservation;

import java.time.LocalDateTime;

public record SignalReturnAlertResponse(

        Long id,

        String vehiclePlate,

        String insuredName,

        LocalDateTime detectedAt,

        Integer previousDelayMinutes,

        String lastObservationText,

        String lastObservationBy,

        LocalDateTime lastObservationAt

) {

    public static SignalReturnAlertResponse from(
            SignalReturnAlert alert,
            VehicleObservation lastObservation
    ) {

        return new SignalReturnAlertResponse(

                alert.getId(),

                alert.getVehicle().getPlate(),

                alert.getVehicle().getInsuredName(),

                alert.getDetectedAt(),

                alert.getPreviousDelayMinutes(),

                lastObservation != null
                        ? lastObservation.getText()
                        : null,

                lastObservation != null
                        ? lastObservation.getCreatedBy()
                        : null,

                lastObservation != null
                        ? lastObservation.getCreatedAt()
                        : null

        );

    }

}
