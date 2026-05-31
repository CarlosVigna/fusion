package com.fusion.fusion.vehicle;

import jakarta.validation.constraints.NotBlank;

public record VehicleRequest(

        @NotBlank
        String plate,

        String insuredName,

        VehiclePlatform platform,

        String partnership,

        String policy,

        String broker,

        String notes

) {
}