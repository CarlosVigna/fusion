package com.fusion.fusion.observation;

import java.time.LocalDateTime;

public record VehicleObservationResponse(

        Long id,

        String vehiclePlate,

        String text,

        LocalDateTime createdAt,

        String createdBy,

        Boolean checkedOff,

        LocalDateTime checkedAt,

        String checkedBy

) {

    public static VehicleObservationResponse from(
            VehicleObservation observation
    ) {

        return new VehicleObservationResponse(

                observation.getId(),

                observation.getVehicle() != null
                        ? observation.getVehicle().getPlate()
                        : null,

                observation.getText(),

                observation.getCreatedAt(),

                observation.getCreatedBy(),

                observation.getCheckedOff(),

                observation.getCheckedAt(),

                observation.getCheckedBy()

        );

    }

}
