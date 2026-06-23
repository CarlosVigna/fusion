package com.fusion.fusion.letter;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record LetterRecordRequest(

        @NotBlank
        String plate,

        String insuredName,

        String base,

        String modelo,

        LocalDate ultimaPosicao,

        @NotNull
        LocalDate dataEnvio,

        LocalDate fimVigencia,

        String osAberta,

        String dataRetornoSinal,

        String operador

) {
}
