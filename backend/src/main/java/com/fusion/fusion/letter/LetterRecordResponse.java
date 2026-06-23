package com.fusion.fusion.letter;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record LetterRecordResponse(

        Long id,

        String plate,

        String insuredName,

        String base,

        String modelo,

        LocalDate ultimaPosicao,

        LocalDate dataEnvio,

        LocalDate fimVigencia,

        String osAberta,

        String dataRetornoSinal,

        String operador,

        LocalDateTime createdAt

) {

    public static LetterRecordResponse from(LetterRecord record) {

        return new LetterRecordResponse(

                record.getId(),

                record.getVehicle() != null
                        ? record.getVehicle().getPlate()
                        : null,

                record.getInsuredName(),

                record.getBase(),

                record.getModelo(),

                record.getUltimaPosicao(),

                record.getDataEnvio(),

                record.getFimVigencia(),

                record.getOsAberta(),

                record.getDataRetornoSinal(),

                record.getOperador(),

                record.getCreatedAt()

        );

    }

}
