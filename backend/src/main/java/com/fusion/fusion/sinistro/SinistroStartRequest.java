package com.fusion.fusion.sinistro;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record SinistroStartRequest(

        @NotBlank
        String plate,

        @NotNull
        LocalDate startDate,

        @NotNull
        LocalDate endDate

) {
}
