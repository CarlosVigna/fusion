package com.fusion.fusion.sinistro;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.Row;

import java.text.Normalizer;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.regex.Pattern;

final class SinistroXlsUtils {

    private static final Pattern DIACRITICS = Pattern.compile("\\p{M}");

    private static final DateTimeFormatter[] DATE_FORMATS = {
            DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss"),
            DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm"),
            DateTimeFormatter.ofPattern("dd/MM/yyyy"),
    };

    private SinistroXlsUtils() {
    }

    static String normalize(String value) {

        if (value == null) return "";

        String decomposed = Normalizer.normalize(value, Normalizer.Form.NFD);

        return DIACRITICS.matcher(decomposed)
                .replaceAll("")
                .toLowerCase()
                .trim();

    }

    static String getCellValue(Row row, Integer columnIndex) {

        if (row == null || columnIndex == null) return null;

        Cell cell = row.getCell(columnIndex);

        if (cell == null) return null;

        return switch (cell.getCellType()) {

            case STRING -> cell.getStringCellValue().trim();

            case NUMERIC -> {
                if (org.apache.poi.ss.usermodel.DateUtil.isCellDateFormatted(cell)) {
                    yield cell.getLocalDateTimeCellValue()
                            .format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss"));
                }
                yield String.valueOf(cell.getNumericCellValue());
            }

            default -> null;

        };

    }

    // Tenta parse direto primeiro (cobre células numéricas do POI que chegam como
    // "70.533" — o ponto é decimal, não separador de milhar). Só faz a limpeza
    // de formato brasileiro ("1.234,56") se o parse direto falhar.
    static Double parseDouble(String value) {

        if (value == null || value.isBlank()) return null;

        String trimmed = value.trim();

        try {
            return Double.parseDouble(trimmed);
        } catch (NumberFormatException ignored) {
        }

        try {
            return Double.parseDouble(trimmed.replace(".", "").replace(",", "."));
        } catch (NumberFormatException ignored) {
        }

        return null;

    }

    static LocalDate parseDate(String value) {

        LocalDateTime dateTime = parseDateTime(value);

        return dateTime != null ? dateTime.toLocalDate() : null;

    }

    static LocalDateTime parseDateTime(String value) {

        if (value == null || value.isBlank()) return null;

        String trimmed = value.trim();

        for (DateTimeFormatter format : DATE_FORMATS) {

            try {
                return LocalDateTime.parse(trimmed, format);
            } catch (Exception ignored) {
            }

            try {
                return LocalDate.parse(trimmed, format).atStartOfDay();
            } catch (Exception ignored) {
            }

        }

        // Formato "dd/MM" sem ano — usa o ano corrente (cabeçalhos de KM Mensal)
        try {
            LocalDate d = LocalDate.parse(trimmed, DateTimeFormatter.ofPattern("dd/MM"));
            return d.withYear(LocalDate.now().getYear()).atStartOfDay();
        } catch (Exception ignored) {
        }

        return null;

    }

}
