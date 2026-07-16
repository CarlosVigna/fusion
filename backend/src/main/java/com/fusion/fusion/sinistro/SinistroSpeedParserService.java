package com.fusion.fusion.sinistro;

import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

// Parser do export "Excesso de Velocidade" do Multiportal. Layout de
// colunas nunca confirmado com um arquivo real — ver aviso em
// SinistroXlsUtils. Cada bloco de 7 dias vem num arquivo separado; o
// caller (SinistroAnalysisService) concatena os resultados de todos os
// blocos antes de calcular indicadores.
@Slf4j
@Service
public class SinistroSpeedParserService {

    public List<SpeedEventEntry> parse(InputStream inputStream) throws IOException {

        try (Workbook workbook = WorkbookFactory.create(inputStream)) {

            Sheet sheet = workbook.getSheetAt(0);

            int headerRowNum = findHeaderRow(sheet);

            if (headerRowNum == -1) {

                log.warn("[SINISTRO] Cabeçalho da planilha Excesso de Velocidade não reconhecido — layout pode ter mudado");

                return List.of();

            }

            Map<String, Integer> columns = mapColumns(sheet.getRow(headerRowNum));

            Integer dateCol = columns.get("dateTime");
            Integer speedCol = columns.get("speed");
            Integer limitCol = columns.get("limit");
            Integer addressCol = columns.get("address");

            List<SpeedEventEntry> entries = new ArrayList<>();

            for (int i = headerRowNum + 1; i <= sheet.getLastRowNum(); i++) {

                Row row = sheet.getRow(i);

                if (row == null) continue;

                LocalDateTime dateTime = SinistroXlsUtils.parseDateTime(
                        SinistroXlsUtils.getCellValue(row, dateCol)
                );

                Double speed = SinistroXlsUtils.parseDouble(
                        SinistroXlsUtils.getCellValue(row, speedCol)
                );

                if (dateTime == null || speed == null) continue;

                Double limit = SinistroXlsUtils.parseDouble(
                        SinistroXlsUtils.getCellValue(row, limitCol)
                );

                String address = SinistroXlsUtils.getCellValue(row, addressCol);

                entries.add(new SpeedEventEntry(dateTime, speed, limit, address));

            }

            return entries;

        }

    }

    private int findHeaderRow(Sheet sheet) {

        for (int i = 0; i <= sheet.getLastRowNum(); i++) {

            Row row = sheet.getRow(i);

            if (row == null) continue;

            for (Cell0 cell : cells(row)) {

                String normalized = SinistroXlsUtils.normalize(cell.value());

                if (normalized.contains("velocidade")) {
                    return i;
                }

            }

        }

        return -1;

    }

    private Map<String, Integer> mapColumns(Row headerRow) {

        Map<String, Integer> columns = new HashMap<>();

        for (Cell0 cell : cells(headerRow)) {

            String normalized = SinistroXlsUtils.normalize(cell.value());

            if (normalized.contains("data") || normalized.contains("hora")) {
                columns.putIfAbsent("dateTime", cell.index());
            } else if (normalized.contains("limite")) {
                columns.putIfAbsent("limit", cell.index());
            } else if (normalized.contains("velocidade")) {
                columns.putIfAbsent("speed", cell.index());
            } else if (normalized.contains("endere") || normalized.contains("local")) {
                columns.putIfAbsent("address", cell.index());
            }

        }

        return columns;

    }

    private List<Cell0> cells(Row row) {

        List<Cell0> result = new ArrayList<>();

        if (row == null) return result;

        for (int i = row.getFirstCellNum(); i < row.getLastCellNum(); i++) {

            String value = SinistroXlsUtils.getCellValue(row, i);

            if (value != null && !value.isBlank()) {
                result.add(new Cell0(i, value));
            }

        }

        return result;

    }

    private record Cell0(int index, String value) {
    }

}
