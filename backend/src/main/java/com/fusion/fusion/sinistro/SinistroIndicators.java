package com.fusion.fusion.sinistro;

import java.time.LocalDate;
import java.util.List;

public record SinistroIndicators(

        Double totalKm,

        LocalDate maxKmDate,

        Double maxKmValue,

        Double avgDailyKm,

        int speedingOccurrences,

        Double maxSpeed,

        List<SuspiciousDay> suspiciousDays

) {

    public record SuspiciousDay(LocalDate date, Double km) {
    }

}
