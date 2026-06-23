package com.fusion.fusion.maintenance;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record MaintenanceRecordRequest(

        @NotBlank
        String plate,

        String insuredName,

        String modelo,

        String localPosicao,

        String cidadeUf,

        @NotNull
        LocalDate data,

        @NotNull
        LocalDate prazoEncerramento,

        String base,

        String operador

) {
}
