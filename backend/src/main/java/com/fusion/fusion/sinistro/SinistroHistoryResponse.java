package com.fusion.fusion.sinistro;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

public record SinistroHistoryResponse(

        UUID id,

        String plate,

        String insuredName,

        LocalDate startDate,

        LocalDate endDate,

        SinistroStatus status,

        LocalDateTime createdAt

) {

    public static SinistroHistoryResponse from(SinistroAnalysis analysis) {

        return new SinistroHistoryResponse(
                analysis.getId(),
                analysis.getPlate(),
                analysis.getInsuredName(),
                analysis.getStartDate(),
                analysis.getEndDate(),
                analysis.getStatus(),
                analysis.getCreatedAt()
        );

    }

}
