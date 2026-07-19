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

        // 1. KM no dia do sinistro
        if (kmSinistroRatio != null) {
            String km1 = fmt1(kmOnSinistroDate);
            String avg1 = fmt1(avgDailyKm);
            if (kmSinistroRatio <= 1.5) {
                indicios.add(indicio(
                        "KM no dia do sinistro dentro do padrão (" + km1 + " km vs média " + avg1 + " km/dia)",
                        "NORMAL"));
            } else if (kmSinistroRatio <= 2.0) {
                indicios.add(indicio(
                        "KM no dia do sinistro acima do normal — " + km1 + " km, " + pct(kmSinistroRatio) + " da média",
                        "ATENCAO"));
            } else {
                indicios.add(indicio(
                        "KM no dia do sinistro muito acima do normal — " + km1 + " km, " + pct(kmSinistroRatio) + " da média",
                        "SUSPEITO"));
            }
        } else if (kmOnSinistroDate == null) {
            indicios.add(indicio("KM do dia do sinistro não encontrado na planilha", "ATENCAO"));
        }

        // 2. Horário
        if (horarioClassification != null) {
            if ("Madrugada".equals(horarioClassification)) {
                indicios.add(indicio("Sinistro declarado na madrugada (" + sinistroTime + ") — horário de maior risco", "SUSPEITO"));
            } else if ("Noturno".equals(horarioClassification)) {
                indicios.add(indicio("Sinistro declarado em horário noturno (" + sinistroTime + ")", "ATENCAO"));
            } else {
                indicios.add(indicio("Horário do sinistro em período comercial (" + sinistroTime + ")", "NORMAL"));
            }
        }

        // 3. Fim de semana
        if (sinistroDate != null) {
            DayOfWeek dow = sinistroDate.getDayOfWeek();
            if (dow == DayOfWeek.SATURDAY || dow == DayOfWeek.SUNDAY) {
                indicios.add(indicio("Sinistro ocorreu em fim de semana — verificar se padrão de uso é consistente", "ATENCAO"));
            }
        }

        // 4. Excesso de velocidade nos 7 dias anteriores
        if (speedingLast7Days == 0) {
            indicios.add(indicio("Sem ocorrências de excesso de velocidade nos 7 dias anteriores ao sinistro", "NORMAL"));
        } else if (speedingLast7Days <= 3) {
            indicios.add(indicio(speedingLast7Days + " ocorrência(s) de excesso de velocidade nos 7 dias anteriores", "ATENCAO"));
        } else {
            indicios.add(indicio(speedingLast7Days + " ocorrências de excesso de velocidade nos 7 dias anteriores — padrão de condução agressivo", "SUSPEITO"));
        }

        if (maxSpeed != null && maxSpeed > 0) {
            indicios.add(indicio("Velocidade máxima registrada no período: " + fmt0(maxSpeed) + " km/h", maxSpeed >= 140 ? "SUSPEITO" : maxSpeed >= 110 ? "ATENCAO" : "NORMAL"));
        }

        // 5. Mudança de padrão nos 7 dias anteriores
        addPatternIndicio(indicios, avgKmLast7DaysRatio, "antes do sinistro");

    }

    // ── Indícios ROUBO/FURTO ─────────────────────────────────────────────

    private void buildIndiciosRoubo(
            List<SinistroIndicators.Indicio> indicios,
            Double kmOnSinistroDate, Double avgDailyKm, Double kmSinistroRatio,
            int speedingLast7Days, Double avgKmLast7Days, Double avgKmLast7DaysRatio
    ) {

        // 1. KM no dia do roubo
        if (kmSinistroRatio != null) {
            String km1 = fmt1(kmOnSinistroDate);
            String avg1 = fmt1(avgDailyKm);
            if (kmSinistroRatio >= 2.0) {
                indicios.add(indicio(
                        "Veículo rodou muito mais que o normal no dia do roubo (" + km1 + " km vs média " + avg1 + " km/dia) — possível deslocamento para local combinado",
                        "SUSPEITO"));
            } else if (kmSinistroRatio <= 0.3) {
                indicios.add(indicio(
                        "Veículo rodou muito menos que o normal no dia do roubo (" + km1 + " km vs média " + avg1 + " km/dia) — saiu pouco, sinistro em local incomum",
                        "ATENCAO"));
            } else if (kmSinistroRatio <= 0.7) {
                indicios.add(indicio(
                        "KM abaixo do normal no dia do roubo (" + km1 + " km vs média " + avg1 + " km/dia)",
                        "ATENCAO"));
            } else {
                indicios.add(indicio(
                        "KM no dia do roubo dentro do padrão (" + km1 + " km vs média " + avg1 + " km/dia)",
                        "NORMAL"));
            }
        } else if (kmOnSinistroDate == null) {
            indicios.add(indicio("KM do dia do roubo não encontrado na planilha", "ATENCAO"));
        }

        // 2. Padrão 7 dias anteriores
        addPatternIndicio(indicios, avgKmLast7DaysRatio, "antes do roubo");

        // 3. Excesso de velocidade
        if (speedingLast7Days == 0) {
            indicios.add(indicio("Sem ocorrências de excesso de velocidade nos 7 dias anteriores ao roubo", "NORMAL"));
        } else if (speedingLast7Days <= 2) {
            indicios.add(indicio(speedingLast7Days + " ocorrência(s) de excesso de velocidade nos 7 dias anteriores", "ATENCAO"));
        } else {
            indicios.add(indicio(speedingLast7Days + " ocorrências de excesso de velocidade nos 7 dias anteriores ao roubo", "SUSPEITO"));
        }

    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private void addPatternIndicio(List<SinistroIndicators.Indicio> indicios, Double ratio, String context) {
        if (ratio == null) return;
        double deviation = Math.abs(ratio - 1.0);
        if (deviation < 0.30) {
            indicios.add(indicio("Padrão de uso nos 7 dias " + context + " consistente com o período geral", "NORMAL"));
        } else if (deviation < 0.60) {
            indicios.add(indicio("Mudança de padrão de uso nos 7 dias " + context + " (" + pct(ratio) + " da média geral)", "ATENCAO"));
        } else {
            indicios.add(indicio("Mudança brusca de padrão nos 7 dias " + context + " (" + pct(ratio) + " da média geral) — comportamento anômalo", "SUSPEITO"));
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
        sb.append("METODOLOGIA\n");
        sb.append(sep).append("\n");
        sb.append("Esta análise compara o comportamento do veículo no dia e nos 7 dias\n");
        sb.append("anteriores ao sinistro com a média do período analisado, identificando\n");
        sb.append("desvios estatísticos que podem indicar irregularidade.\n");
        sb.append("\n");
        sb.append("Análise gerada pelo Fusion em ")
                .append(LocalDateTime.now(ZoneOffset.UTC).format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")))
                .append(" UTC.\n");
        sb.append("Dados extraídos do Multiportal. Esta análise é um auxílio à decisão\n");
        sb.append("e não substitui a avaliação do analista de sinistros.\n");

        return sb.toString();

    }

}
