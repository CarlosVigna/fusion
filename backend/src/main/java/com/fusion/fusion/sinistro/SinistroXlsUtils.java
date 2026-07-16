package com.fusion.fusion.sinistro;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.Row;

import java.text.Normalizer;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.regex.Pattern;

// Utilitarios compartilhados pelos parsers de KM Mensal e Excesso de
// Velocidade. O layout exato dessas duas planilhas do Multiportal nao
// foi confirmado com um arquivo real — os parsers detectam colunas por
// palavra-chave no cabecalho (normalizado, sem acento) em vez de indice
// fixo, exatamente para tolerar variacoes de layout. Se os indicadores
// saírem vazios/errados em produção, o primeiro lugar a olhar é
// mapColumns() nos dois parsers — não a lógica de indicadores.
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

    static Double parseDouble(String value) {

        if (value == null || value.isBlank()) return null;

        try {
            return Double.parseDouble(
                    value.replace(".", "").replace(",", ".").trim()
            );
        } catch (NumberFormatException e) {
            try {
                return Double.parseDouble(value.trim());
            } catch (NumberFormatException e2) {
                return null;
            }
        }

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
                // tenta o proximo formato / cai pro parse so-de-data abaixo
            }

            try {
                return LocalDate.parse(trimmed, format).atStartOfDay();
            } catch (Exception ignored) {
                // tenta o proximo formato
            }

        }

        return null;

    }

}
