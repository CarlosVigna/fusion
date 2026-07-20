package com.fusion.fusion.sinistro;

import java.time.LocalDate;
import java.util.List;

public record SinistroIndicators(

        // Tipo e contexto do sinistro
        SinistroType sinistroType,
        String sinistroWeekday,
        String horarioClassification,

        // KM do período completo
        Double totalKm,
        Double avgDailyKm,
        LocalDate maxKmDate,
        Double maxKmValue,

        // KM no dia do sinistro vs média
        Double kmOnSinistroDate,
        Double kmSinistroRatio,         // kmOnSinistroDate / avgDailyKm

        // Padrão nos 7 dias anteriores ao sinistro
        Double avgKmLast7Days,
        Double avgKmLast7DaysRatio,     // vs avgDailyKm geral

        // Velocidade
        int speedingOccurrences,        // total no período
        int speedingLast7Days,          // nos 7 dias anteriores ao sinistro
        Double maxSpeed,

        // Ignição: horas ligada no período
        Double totalHorasLigada,       // soma do período (ex: 42.5 h)
        Double avgHorasLigadaDia,      // média por dia com uso > 0
        Double horasLigadaSinistro,    // horas no dia do sinistro

        // Indícios identificados com classificação
        List<Indicio> indicios,

        // Legado — manter para não quebrar JSON já armazenado
        List<SuspiciousDay> suspiciousDays

) {

    // classificacao: "NORMAL" | "ATENCAO" | "SUSPEITO"
    public record Indicio(String descricao, String classificacao) {}

    public record SuspiciousDay(LocalDate date, Double km) {}

}
