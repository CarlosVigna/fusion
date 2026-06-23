package com.fusion.fusion.observation;

import jakarta.validation.constraints.NotBlank;

public record VehicleObservationRequest(

        @NotBlank
        String text

) {
}
