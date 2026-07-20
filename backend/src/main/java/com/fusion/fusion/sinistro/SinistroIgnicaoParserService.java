package com.fusion.fusion.sinistro;

import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

// Parser do export "Tempo de Ignição" do Multiportal (acumuladosReportIgnicao.seam).
// Layout confirmado:
//   Linhas 1-3 (índices 0-2): lixo / cabeçalho do relatório (ignorar)
//   Linha 4 (índice 3): cabeçalho das colunas:
//     Data | Dia da semana | Tempo ligada | Tempo desligada | Motor ocioso |
//     Tempo viagem | Total viagens | Estacionamento | Total estacionamentos | KM
//   Linha 5+ (índice 4+): dados por dia
// Formato de tempo: HH:mm ou HH:mm:ss → convertido para minutos.
@Slf4j
@Service
public class SinistroIgnicaoParserService {

    public List<IgnicaoDayEntry> parse(InputStream inputStream) throws IOException {

        try (Workbook workbook = WorkbookFactory.create(inputStream)) {

            Sheet sheet = workbook.getSheetAt(0);

            // Localizar cabeçalho: primeira linha cuja col 0 normalizada == "data"
            int headerRowNum = -1;
            for (int i = 0; i <= Math.min(sheet.getLastRowNum(), 10); i++) {
                Row row = sheet.getRow(i);
                if (row == null) continue;
                String first = SinistroXlsUtils.normalize(SinistroXlsUtils.getCellValue(row, 0));
                if ("data".equals(first)) {
                    headerRowNum = i;
                    break;
                }
            }

            if (headerRowNum == -1) {
                log.warn("[SINISTRO] Cabeçalho Ignição não encontrado (col A='Data' não encontrada nas primeiras 10 linhas)");
                return List.of();
            }

            Row headerRow = sheet.getRow(headerRowNum);
            Map<String, Integer> columns = mapColumns(headerRow);

            Integer dateCol    = columns.get("date");
            Integer minutosCol = columns.get("minutos");
            Integer kmCol      = columns.get("km");

            if (dateCol == null) {
                log.warn("[SINISTRO] Coluna 'Data' não mapeada no Ignição");
                return List.of();
            }

            List<IgnicaoDayEntry> entries = new ArrayList<>();

            for (int i = headerRowNum + 1; i <= sheet.getLastRowNum(); i++) {

                Row row = sheet.getRow(i);
                if (row == null) continue;

                String rawDate = SinistroXlsUtils.getCellValue(row, dateCol);
                if (rawDate == null || rawDate.isBlank()) continue;

                // Linha de total ou rodapé — interrompe
                String firstNorm = SinistroXlsUtils.normalize(rawDate);
                if (firstNorm.startsWith("total") || firstNorm.startsWith("media")) break;

                LocalDate date = SinistroXlsUtils.parseDate(rawDate);
                if (date == null) {
                    log.debug("[SINISTRO] Ignição: data não parseada: '{}'", rawDate);
                    continue;
                }

                Integer minutos = minutosCol != null
                        ? parseMinutos(SinistroXlsUtils.getCellValue(row, minutosCol))
                        : null;

                Double km = kmCol != null
                        ? SinistroXlsUtils.parseDouble(SinistroXlsUtils.getCellValue(row, kmCol))
                        : null;

                entries.add(new IgnicaoDayEntry(date, minutos, km));

            }

            log.info("[SINISTRO] Ignição: {} entradas parseadas", entries.size());
            return entries;

        }

    }

    private Map<String, Integer> mapColumns(Row headerRow) {

        Map<String, Integer> columns = new HashMap<>();

        for (int col = headerRow.getFirstCellNum(); col < headerRow.getLastCellNum(); col++) {

            String value = SinistroXlsUtils.getCellValue(headerRow, col);
            if (value == null || value.isBlank()) continue;

            String normalized = SinistroXlsUtils.normalize(value);

            if ("data".equals(normalized)) {
                columns.putIfAbsent("date", col);
            } else if (normalized.contains("tempo ligada") || normalized.equals("ligada")) {
                columns.putIfAbsent("minutos", col);
            } else if ("km".equals(normalized)) {
                columns.putIfAbsent("km", col);
            }

        }

        return columns;

    }

    // "08:30" → 510 min  |  "08:30:45" → 510 min (trunca segundos)
    static Integer parseMinutos(String value) {

        if (value == null || value.isBlank()) return null;

        try {
            String[] parts = value.trim().split(":");
            if (parts.length >= 2) {
                int hours   = Integer.parseInt(parts[0].trim());
                int minutes = Integer.parseInt(parts[1].trim());
                return hours * 60 + minutes;
            }
        } catch (NumberFormatException ignored) {
        }

        return null;

    }

}
