package com.fusion.fusion.sinistro;

import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

@Service
public class SinistroIndicatorService {

    public SinistroIndicators compute(List<KmDayEntry> kmData, List<SpeedEventEntry> speedData) {

        int days = kmData.size();

        double totalKm = kmData.stream().mapToDouble(KmDayEntry::km).sum();

        // Valores 0 e 1 são ruído de leitura do portal — excluir da média
        List<KmDayEntry> validDays = kmData.stream()
                .filter(e -> e.km() != null && e.km() > 1.0)
                .toList();

        Double avgDailyKm = !validDays.isEmpty()
                ? validDays.stream().mapToDouble(KmDayEntry::km).sum() / validDays.size()
                : (days > 0 ? totalKm / days : null);

        KmDayEntry maxDay = kmData.stream()
                .max(Comparator.comparingDouble(KmDayEntry::km))
                .orElse(null);

        double avgForComparison = avgDailyKm != null ? avgDailyKm : 0;

        List<SinistroIndicators.SuspiciousDay> suspiciousDays = kmData.stream()
                .filter(entry -> avgForComparison > 0 && entry.km() > avgForComparison * 2)
                .map(entry -> new SinistroIndicators.SuspiciousDay(entry.date(), entry.km()))
                .sorted(Comparator.comparing(SinistroIndicators.SuspiciousDay::date))
                .toList();

        Double maxSpeed = speedData.stream()
                .map(SpeedEventEntry::speed)
                .filter(Objects::nonNull)
                .max(Double::compareTo)
                .orElse(null);

        return new SinistroIndicators(
                days > 0 ? totalKm : null,
                maxDay != null ? maxDay.date() : null,
                maxDay != null ? maxDay.km() : null,
                avgDailyKm,
                speedData.size(),
                maxSpeed,
                suspiciousDays
        );

    }

    public String buildReport(
            String plate,
            String insuredName,
            LocalDate startDate,
            LocalDate endDate,
            SinistroIndicators indicators
    ) {

        StringBuilder report = new StringBuilder();

        report.append("Análise de Sinistro — ").append(plate).append("\n");

        if (insuredName != null && !insuredName.isBlank()) {
            report.append("Segurado: ").append(insuredName).append("\n");
        }

        report.append("Período: ").append(startDate).append(" a ").append(endDate).append("\n\n");

        if (indicators.totalKm() == null) {

            report.append("Não foi possível identificar os dados de KM na planilha recebida "
                    + "(layout da planilha pode ter mudado).\n");

        } else {

            report.append(String.format("KM total no período: %.1f km%n", indicators.totalKm()));
            report.append(String.format("Média diária de KM: %.1f km%n", indicators.avgDailyKm()));

            if (indicators.maxKmDate() != null) {
                report.append(String.format(
                        "Dia com maior KM: %s (%.1f km)%n",
                        indicators.maxKmDate(),
                        indicators.maxKmValue()
                ));
            }

        }

        report.append("\n");
        report.append("Ocorrências de excesso de velocidade: ")
                .append(indicators.speedingOccurrences())
                .append("\n");

        if (indicators.maxSpeed() != null) {
            report.append(String.format("Velocidade máxima registrada: %.0f km/h%n", indicators.maxSpeed()));
        }

        if (!indicators.suspiciousDays().isEmpty()) {

            report.append("\nDias suspeitos (KM > 2x a média do período):\n");

            for (SinistroIndicators.SuspiciousDay day : indicators.suspiciousDays()) {
                report.append(String.format("  - %s: %.1f km%n", day.date(), day.km()));
            }

        }

        return report.toString();

    }

}
