package com.fusion.fusion.sinistro;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record SinistroStatusResponse(

        UUID id,

        String plate,

        String insuredName,

        LocalDate startDate,

        LocalDate endDate,

        SinistroStatus status,

        List<KmDayEntry> kmData,

        List<SpeedEventEntry> speedData,

        SinistroIndicators indicators,

        String report,

        String errorMessage,

        LocalDateTime createdAt

) {
}
