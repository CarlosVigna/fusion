package com.fusion.fusion.vehicle.multiportal.operational;

import jakarta.validation.constraints.NotBlank;

public record OperationalUpdateRequest(

        @NotBlank
        String rawContent

) {
}