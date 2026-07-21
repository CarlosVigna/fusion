package com.fusion.fusion.sinistro;

import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

@Service
public class SinistroIndicatorService {

    public SinistroIndicators compute(
            List<KmDayEntry> kmData,
            List<SpeedEventEntry> speedData,
            List<IgnicaoDayEntry> ignicaoData,
            SinistroType sinistroType,
            LocalDate sinistroDate,
            String sinistroTime
    ) {

        // ── KM do período ────────────────────────────────────────────────
        List<KmDayEntry> validDays = kmData.stream()
                .filter(e -> e.km() != null && e.km() > 1.0)
                .toList();

        double totalKm = kmData.stream().mapToDouble(KmDayEntry::km).sum();

        Double avgDailyKm = !validDays.isEmpty()
                ? validDays.stream().mapToDouble(KmDayEntry::km).sum() / validDays.size()
                : null;

        KmDayEntry maxDay = kmData.stream()
                .max(Comparator.comparingDouble(KmDayEntry::km))
                .orElse(null);

        // ── KM no dia do sinistro ─────────────────────────────────────────
        Double kmOnSinistroDate = sinistroDate != null
                ? kmData.stream()
                        .filter(e -> sinistroDate.equals(e.date()))
                        .map(KmDayEntry::km)
                        .findFirst()
                        .orElse(null)
                : null;

        Double kmSinistroRatio = (kmOnSinistroDate != null && avgDailyKm != null && avgDailyKm > 0)
                ? kmOnSinistroDate / avgDailyKm
                : null;

        // ── Padrão 7 dias anteriores ──────────────────────────────────────
        Double avgKmLast7Days = null;
        Double avgKmLast7DaysRatio = null;

        if (sinistroDate != null) {
            LocalDate sevenBefore = sinistroDate.minusDays(7);
            List<KmDayEntry> last7 = kmData.stream()
                    .filter(e -> !e.date().isBefore(sevenBefore) && e.date().isBefore(sinistroDate))
                    .filter(e -> e.km() != null && e.km() > 1.0)
                    .toList();
            if (!last7.isEmpty()) {
                avgKmLast7Days = last7.stream().mapToDouble(KmDayEntry::km).average().orElse(0);
                if (avgDailyKm != null && avgDailyKm > 0) {
                    avgKmLast7DaysRatio = avgKmLast7Days / avgDailyKm;
                }
            }
        }

        // ── Velocidade ────────────────────────────────────────────────────
        int speedingOccurrences = speedData.size();

        int speedingLast7Days = 0;
        if (sinistroDate != null) {
            LocalDate sevenBefore = sinistroDate.minusDays(7);
            speedingLast7Days = (int) speedData.stream()
                    .filter(e -> e.dateTime() != null)
                    .filter(e -> {
                        LocalDate d = e.dateTime().toLocalDate();
                        return !d.isBefore(sevenBefore) && !d.isAfter(sinistroDate);
                    })
                    .count();
        }

        Double maxSpeed = speedData.stream()
                .map(SpeedEventEntry::speed)
                .filter(Objects::nonNull)
                .max(Double::compareTo)
                .orElse(null);

        // ── Contexto do sinistro ──────────────────────────────────────────
        String sinistroWeekday = sinistroDate != null ? weekdayName(sinistroDate.getDayOfWeek()) : null;
        String horarioClassification = sinistroTime != null ? classifyHorario(sinistroTime) : null;

        // ── Ignição ───────────────────────────────────────────────────────
        List<IgnicaoDayEntry> ignicao = ignicaoData != null ? ignicaoData : List.of();

        List<IgnicaoDayEntry> ignicaoDaysWithUse = ignicao.stream()
                .filter(e -> e.minutosLigada() != null && e.minutosLigada() > 0)
                .toList();

        Double totalHorasLigada = ignicaoDaysWithUse.isEmpty() ? null
                : ignicaoDaysWithUse.stream().mapToInt(IgnicaoDayEntry::minutosLigada).sum() / 60.0;

        Double avgHorasLigadaDia = ignicaoDaysWithUse.isEmpty() ? null
                : ignicaoDaysWithUse.stream().mapToInt(IgnicaoDayEntry::minutosLigada).average().orElse(0) / 60.0;

        Double horasLigadaSinistro = null;
        if (sinistroDate != null && !ignicao.isEmpty()) {
            horasLigadaSinistro = ignicao.stream()
                    .filter(e -> sinistroDate.equals(e.date()) && e.minutosLigada() != null)
                    .map(e -> e.minutosLigada() / 60.0)
                    .findFirst()
                    .orElse(null);
        }

        // ── Legado: dias suspeitos ────────────────────────────────────────
        double avgForSuspicious = avgDailyKm != null ? avgDailyKm : 0;
        List<SinistroIndicators.SuspiciousDay> suspiciousDays = kmData.stream()
                .filter(e -> avgForSuspicious > 0 && e.km() > avgForSuspicious * 2)
                .map(e -> new SinistroIndicators.SuspiciousDay(e.date(), e.km()))
                .sorted(Comparator.comparing(SinistroIndicators.SuspiciousDay::date))
                .toList();

        // ── Indícios ──────────────────────────────────────────────────────
        List<SinistroIndicators.Indicio> indicios = new ArrayList<>();

        if (sinistroType == SinistroType.COLISAO) {
            buildIndiciosColisao(indicios, kmOnSinistroDate, avgDailyKm, kmSinistroRatio,
                    sinistroTime, horarioClassification, sinistroDate,
                    speedingLast7Days, avgKmLast7Days, avgKmLast7DaysRatio, maxSpeed);
        } else if (sinistroType == SinistroType.ROUBO) {
            buildIndiciosRoubo(indicios, kmOnSinistroDate, avgDailyKm, kmSinistroRatio,
                    speedingLast7Days, avgKmLast7Days, avgKmLast7DaysRatio);
        }

        addIndiciosIgnicao(indicios, horasLigadaSinistro, avgHorasLigadaDia, sinistroType);

        return new SinistroIndicators(
                sinistroType,
                sinistroWeekday,
                horarioClassification,
                !validDays.isEmpty() ? totalKm : null,
                avgDailyKm,
                maxDay != null ? maxDay.date() : null,
                maxDay != null ? maxDay.km() : null,
                kmOnSinistroDate,
                kmSinistroRatio,
                avgKmLast7Days,
                avgKmLast7DaysRatio,
                speedingOccurrences,
                speedingLast7Days,
                maxSpeed,
                totalHorasLigada,
                avgHorasLigadaDia,
                horasLigadaSinistro,
                indicios,
                suspiciousDays
        );

    }

    // ── Indícios COLISÃO ─────────────────────────────────────────────────

    private void buildIndiciosColisao(
            List<SinistroIndicators.Indicio> indicios,
            Double kmOnSinistroDate, Double avgDailyKm, Double kmSinistroRatio,
            String sinistroTime, String horarioClassification, LocalDate sinistroDate,
            int speedingLast7Days, Double avgKmLast7Days, Double avgKmLast7DaysRatio,
            Double maxSpeed
    ) {

        // 1. KM no dia da colisão
        if (kmSinistroRatio != null) {
            String km1 = fmt1(kmOnSinistroDate) + " km";
            String avg1 = fmt1(avgDailyKm) + " km/dia";
            if (kmSinistroRatio <= 1.5) {
                indicios.add(indicio(
                        "KM no dia da colisão dentro do padrão histórico (" + km1 + " vs média " + avg1 + ")",
                        "NORMAL"));
            } else if (kmSinistroRatio <= 2.0) {
                indicios.add(indicio(
                        "Veículo rodou mais que o normal no dia da colisão (" + km1 + " vs média " + avg1 + ")",
                        "ATENCAO"));
            } else {
                indicios.add(indicio(
                        "Veículo rodou mais que o normal no dia da colisão (" + km1 + " vs média " + avg1 + ")",
                        "SUSPEITO"));
            }
        } else if (kmOnSinistroDate == null) {
            indicios.add(indicio("KM do dia da colisão não encontrado na planilha KM Mensal", "ATENCAO"));
        }

        // 2. Horário declarado
        if (horarioClassification != null && sinistroTime != null) {
            String h = sinistroTime;
            if ("Madrugada".equals(horarioClassification)) {
                indicios.add(indicio("Sinistro declarado em horário de madrugada (" + h + "h)", "SUSPEITO"));
            } else if ("Noturno".equals(horarioClassification)) {
                indicios.add(indicio("Sinistro declarado em horário noturno (" + h + "h)", "ATENCAO"));
            } else {
                indicios.add(indicio("Sinistro declarado em horário comercial (" + h + "h)", "NORMAL"));
            }
        }

        // 3. Fim de semana
        if (sinistroDate != null) {
            DayOfWeek dow = sinistroDate.getDayOfWeek();
            if (dow == DayOfWeek.SATURDAY || dow == DayOfWeek.SUNDAY) {
                indicios.add(indicio(
                        "Sinistro declarado em fim de semana (" + weekdayName(dow) + ")",
                        "ATENCAO"));
            }
        }

        // 4. Excesso de velocidade nos 7 dias anteriores à colisão
        if (speedingLast7Days == 0) {
            indicios.add(indicio(
                    "Nenhuma ocorrência de excesso de velocidade nos 7 dias anteriores à colisão",
                    "NORMAL"));
        } else if (speedingLast7Days <= 3) {
            indicios.add(indicio(
                    "Registradas " + speedingLast7Days + " ocorrência(s) de excesso de velocidade nos 7 dias anteriores à colisão",
                    "ATENCAO"));
        } else {
            indicios.add(indicio(
                    "Registradas " + speedingLast7Days + " ocorrências de excesso de velocidade nos 7 dias anteriores à colisão",
                    "SUSPEITO"));
        }

        // 5. Velocidade máxima
        if (maxSpeed != null && maxSpeed > 0) {
            indicios.add(indicio(
                    "Velocidade máxima registrada no período: " + fmt0(maxSpeed) + " km/h",
                    maxSpeed >= 140 ? "SUSPEITO" : maxSpeed >= 110 ? "ATENCAO" : "NORMAL"));
        }

        // 6. Padrão 7 dias anteriores
        addPatternIndicio(indicios, avgKmLast7Days, avgDailyKm, avgKmLast7DaysRatio);

    }

    // ── Indícios ROUBO/FURTO ─────────────────────────────────────────────

    private void buildIndiciosRoubo(
            List<SinistroIndicators.Indicio> indicios,
            Double kmOnSinistroDate, Double avgDailyKm, Double kmSinistroRatio,
            int speedingLast7Days, Double avgKmLast7Days, Double avgKmLast7DaysRatio
    ) {

        // 1. KM no dia declarado do sinistro
        if (kmSinistroRatio != null) {
            String km1 = fmt1(kmOnSinistroDate) + " km";
            String avg1 = fmt1(avgDailyKm) + " km/dia";
            if (kmSinistroRatio >= 2.0) {
                indicios.add(indicio(
                        "Veículo rodou mais que o normal no dia declarado do sinistro (" + km1 + " vs média " + avg1 + ")",
                        "SUSPEITO"));
            } else if (kmSinistroRatio <= 0.3) {
                indicios.add(indicio(
                        "Veículo rodou menos que o normal no dia declarado do sinistro (" + km1 + " vs média " + avg1 + ")",
                        "SUSPEITO"));
            } else if (kmSinistroRatio <= 0.7) {
                indicios.add(indicio(
                        "Veículo rodou menos que o normal no dia declarado do sinistro (" + km1 + " vs média " + avg1 + ")",
                        "ATENCAO"));
            } else {
                indicios.add(indicio(
                        "KM no dia do sinistro dentro do padrão histórico (" + km1 + " vs média " + avg1 + ")",
                        "NORMAL"));
            }
        } else if (kmOnSinistroDate == null) {
            indicios.add(indicio("KM do dia do sinistro não encontrado na planilha KM Mensal", "ATENCAO"));
        }

        // 2. Padrão 7 dias anteriores
        addPatternIndicio(indicios, avgKmLast7Days, avgDailyKm, avgKmLast7DaysRatio);

        // 3. Excesso de velocidade nos 7 dias anteriores ao sinistro
        if (speedingLast7Days == 0) {
            indicios.add(indicio(
                    "Nenhuma ocorrência de excesso de velocidade nos 7 dias anteriores ao sinistro",
                    "NORMAL"));
        } else if (speedingLast7Days <= 2) {
            indicios.add(indicio(
                    "Registradas " + speedingLast7Days + " ocorrência(s) de excesso de velocidade nos 7 dias anteriores ao sinistro",
                    "ATENCAO"));
        } else {
            indicios.add(indicio(
                    "Registradas " + speedingLast7Days + " ocorrências de excesso de velocidade nos 7 dias anteriores ao sinistro",
                    "SUSPEITO"));
        }

    }

    // ── Indícios Ignição ─────────────────────────────────────────────────

    private void addIndiciosIgnicao(
            List<SinistroIndicators.Indicio> indicios,
            Double horasLigadaSinistro,
            Double avgHorasLigadaDia,
            SinistroType sinistroType
    ) {

        if (horasLigadaSinistro == null || avgHorasLigadaDia == null || avgHorasLigadaDia == 0) return;

        double ratio = horasLigadaSinistro / avgHorasLigadaDia;
        String hSin = fmt1(horasLigadaSinistro) + "h";
        String hAvg = fmt1(avgHorasLigadaDia) + "h";

        if (sinistroType == SinistroType.COLISAO) {
            if (ratio > 2.0) {
                indicios.add(indicio(
                        "Veículo ficou " + hSin + " ligado no dia da colisão (média do período: " + hAvg + ")",
                        "SUSPEITO"));
            } else if (ratio > 1.4) {
                indicios.add(indicio(
                        "Veículo ficou " + hSin + " ligado no dia da colisão (média do período: " + hAvg + ")",
                        "ATENCAO"));
            } else {
                indicios.add(indicio(
                        "Tempo de ignição no dia da colisão dentro do padrão (" + hSin + " vs média " + hAvg + ")",
                        "NORMAL"));
            }
        } else {
            if (horasLigadaSinistro < 0.1) {
                indicios.add(indicio(
                        "Nenhum registro de ignição no dia declarado do sinistro",
                        "NORMAL"));
            } else if (ratio > 1.5) {
                indicios.add(indicio(
                        "Veículo ficou " + hSin + " ligado no dia declarado do sinistro (média do período: " + hAvg + ")",
                        "ATENCAO"));
            } else {
                indicios.add(indicio(
                        "Veículo ficou " + hSin + " ligado no dia declarado do sinistro (média do período: " + hAvg + ")",
                        "NORMAL"));
            }
        }

    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private void addPatternIndicio(
            List<SinistroIndicators.Indicio> indicios,
            Double avgKmLast7Days, Double avgDailyKm, Double ratio
    ) {
        if (ratio == null || avgKmLast7Days == null || avgDailyKm == null) return;
        String x = fmt1(avgKmLast7Days) + " km/dia";
        String y = fmt1(avgDailyKm) + " km/dia";
        double deviation = Math.abs(ratio - 1.0);
        if (deviation < 0.30) {
            indicios.add(indicio(
                    "KM médio nos 7 dias anteriores (" + x + ") dentro da média geral do período (" + y + ")",
                    "NORMAL"));
        } else if (deviation < 0.60) {
            indicios.add(indicio(
                    "KM médio nos 7 dias anteriores (" + x + ") difere da média geral do período (" + y + ")",
                    "ATENCAO"));
        } else {
            indicios.add(indicio(
                    "KM médio nos 7 dias anteriores (" + x + ") difere da média geral do período (" + y + ")",
                    "SUSPEITO"));
        }
    }

    private SinistroIndicators.Indicio indicio(String descricao, String classificacao) {
        return new SinistroIndicators.Indicio(descricao, classificacao);
    }

    private String classifyHorario(String time) {
        try {
            int hour = Integer.parseInt(time.substring(0, 2));
            if (hour < 5) return "Madrugada";
            if (hour >= 22) return "Noturno";
            return "Comercial/Tarde";
        } catch (Exception e) {
            return null;
        }
    }

    private String weekdayName(DayOfWeek dow) {
        return switch (dow) {
            case MONDAY    -> "Segunda-feira";
            case TUESDAY   -> "Terça-feira";
            case WEDNESDAY -> "Quarta-feira";
            case THURSDAY  -> "Quinta-feira";
            case FRIDAY    -> "Sexta-feira";
            case SATURDAY  -> "Sábado";
            case SUNDAY    -> "Domingo";
        };
    }

    private String fmt1(Double v) {
        return v != null ? String.format("%.1f", v) : "?";
    }

    private String fmt0(Double v) {
        return v != null ? String.format("%.0f", v) : "?";
    }

    private String pct(Double ratio) {
        return String.format("%.0f%%", ratio * 100);
    }

    // ── Relatório texto ───────────────────────────────────────────────────

    public String buildReport(
            String plate,
            String insuredName,
            LocalDate startDate,
            LocalDate endDate,
            SinistroIndicators ind
    ) {

        StringBuilder sb = new StringBuilder();
        String sep = "─".repeat(60);

        sb.append("ANÁLISE DE SINISTRO — RELATÓRIO DE INDÍCIOS\n");
        sb.append(sep).append("\n");
        sb.append("Placa: ").append(plate).append("\n");
        if (insuredName != null && !insuredName.isBlank()) {
            sb.append("Segurado: ").append(insuredName).append("\n");
        }
        sb.append("Tipo de sinistro: ").append(
                ind.sinistroType() == SinistroType.COLISAO ? "COLISÃO" : "ROUBO/FURTO").append("\n");
        sb.append("Período analisado: ").append(startDate).append(" a ").append(endDate).append("\n");

        if (ind.sinistroWeekday() != null || ind.horarioClassification() != null) {
            sb.append("Contexto declarado: ");
            if (ind.sinistroWeekday() != null) sb.append(ind.sinistroWeekday());
            if (ind.horarioClassification() != null) sb.append(", ").append(ind.horarioClassification());
            sb.append("\n");
        }

        sb.append("\n").append(sep).append("\n");
        sb.append("KM DO PERÍODO\n");
        sb.append(sep).append("\n");

        if (ind.totalKm() != null) {
            sb.append(String.format("KM total no período:      %.1f km%n", ind.totalKm()));
            sb.append(String.format("Média diária:             %.1f km/dia%n", ind.avgDailyKm()));
            if (ind.maxKmDate() != null) {
                sb.append(String.format("Dia com maior KM:         %s (%.1f km)%n", ind.maxKmDate(), ind.maxKmValue()));
            }
        } else {
            sb.append("Dados de KM não disponíveis.\n");
        }

        if (ind.kmOnSinistroDate() != null) {
            sb.append(String.format("KM no dia do sinistro:    %.1f km", ind.kmOnSinistroDate()));
            if (ind.kmSinistroRatio() != null) {
                sb.append(String.format(" (%.0f%% da média)", ind.kmSinistroRatio() * 100));
            }
            sb.append("\n");
        }

        if (ind.avgKmLast7Days() != null) {
            sb.append(String.format("KM médio — 7 dias antes:  %.1f km/dia", ind.avgKmLast7Days()));
            if (ind.avgKmLast7DaysRatio() != null) {
                sb.append(String.format(" (%.0f%% da média geral)", ind.avgKmLast7DaysRatio() * 100));
            }
            sb.append("\n");
        }

        sb.append("\n").append(sep).append("\n");
        sb.append("EXCESSO DE VELOCIDADE\n");
        sb.append(sep).append("\n");
        sb.append("Ocorrências no período:   ").append(ind.speedingOccurrences()).append("\n");
        sb.append("Ocorrências — 7 dias antes: ").append(ind.speedingLast7Days()).append("\n");
        if (ind.maxSpeed() != null) {
            sb.append(String.format("Velocidade máxima:        %.0f km/h%n", ind.maxSpeed()));
        }

        sb.append("\n").append(sep).append("\n");
        sb.append("INDÍCIOS IDENTIFICADOS\n");
        sb.append(sep).append("\n");

        if (ind.indicios() == null || ind.indicios().isEmpty()) {
            sb.append("Nenhum indício identificado.\n");
        } else {
            for (var i : ind.indicios()) {
                String tag = switch (i.classificacao()) {
                    case "SUSPEITO" -> "[🔴 SUSPEITO]";
                    case "ATENCAO"  -> "[⚠️  ATENÇÃO ]";
                    default         -> "[✅ NORMAL  ]";
                };
                sb.append(tag).append(" ").append(i.descricao()).append("\n");
            }
        }

        sb.append("\n").append(sep).append("\n");
        sb.append("IGNIÇÃO\n");
        sb.append(sep).append("\n");
        if (ind.totalHorasLigada() != null) {
            sb.append(String.format("Total ligada no período:  %.1f h%n", ind.totalHorasLigada()));
            sb.append(String.format("Média por dia com uso:    %.1f h/dia%n", ind.avgHorasLigadaDia()));
        }
        if (ind.horasLigadaSinistro() != null) {
            sb.append(String.format("Ligada no dia do sinistro: %.1f h%n", ind.horasLigadaSinistro()));
        }
        if (ind.totalHorasLigada() == null && ind.horasLigadaSinistro() == null) {
            sb.append("Dados de ignição não disponíveis.\n");
        }

        sb.append("\n").append(sep).append("\n");
        sb.append("METODOLOGIA\n");
        sb.append(sep).append("\n");
        boolean isColisao = ind.sinistroType() == SinistroType.COLISAO;
        if (isColisao) {
            sb.append("O que foi verificado         Fonte                          Como interpretamos\n");
            sb.append("─────────────────────────────────────────────────────────────────────────────\n");
            sb.append(String.format("%-28s %-30s %s%n", "KM no dia da colisão", "Planilha KM Mensal", "vs. média diária do período"));
            sb.append(String.format("%-28s %-30s %s%n", "Tempo de ignição", "Planilha Tempo de Ignição", "Horas ligado no dia da colisão"));
            sb.append(String.format("%-28s %-30s %s%n", "Excesso de velocidade", "Planilha Excesso Velocidade", "Ocorrências nos 7 dias anteriores"));
            sb.append(String.format("%-28s %-30s %s%n", "Horário declarado", "Informado pelo analista", "Comercial / Noturno / Madrugada"));
        } else {
            sb.append("O que foi verificado         Fonte                          Como interpretamos\n");
            sb.append("─────────────────────────────────────────────────────────────────────────────\n");
            sb.append(String.format("%-28s %-30s %s%n", "KM no dia do roubo", "Planilha KM Mensal", "vs. média diária do período"));
            sb.append(String.format("%-28s %-30s %s%n", "Padrão 7 dias antes", "Planilha KM Mensal", "Média dos 7 dias vs. média geral"));
            sb.append(String.format("%-28s %-30s %s%n", "Excesso de velocidade", "Planilha Excesso Velocidade", "Ocorrências nos 7 dias anteriores"));
            sb.append(String.format("%-28s %-30s %s%n", "Ignição no dia", "Planilha Tempo de Ignição", "Horas ligado no dia declarado"));
        }
        sb.append("\n");
        sb.append("Análise gerada pelo Fusion em ")
                .append(LocalDateTime.now(ZoneOffset.UTC).format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")))
                .append(" UTC.\n");
        sb.append("Dados extraídos do Multiportal. Esta análise é um auxílio à decisão\n");
        sb.append("e não substitui a avaliação do analista de sinistros.\n");

        return sb.toString();

    }

}
