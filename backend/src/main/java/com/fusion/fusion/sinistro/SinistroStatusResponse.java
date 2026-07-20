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

        LocalDate sinistroDate,

        String sinistroTime,

        SinistroType sinistroType,

        SinistroStatus status,

        List<KmDayEntry> kmData,

        List<SpeedEventEntry> speedData,

        List<IgnicaoDayEntry> ignicaoData,

        SinistroIndicators indicators,

        String report,

        String errorMessage,

        LocalDateTime createdAt

) {
}
