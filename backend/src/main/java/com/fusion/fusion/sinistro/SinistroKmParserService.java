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

// Parser do export "KM Mensal" do Multiportal. Layout de colunas nunca
// confirmado com um arquivo real — ver aviso em SinistroXlsUtils.
@Slf4j
@Service
public class SinistroKmParserService {

    public List<KmDayEntry> parse(InputStream inputStream) throws IOException {

        try (Workbook workbook = WorkbookFactory.create(inputStream)) {

            Sheet sheet = workbook.getSheetAt(0);

            int headerRowNum = findHeaderRow(sheet);

            if (headerRowNum == -1) {

                log.warn("[SINISTRO] Cabeçalho da planilha KM Mensal não reconhecido — layout pode ter mudado");

                return List.of();

            }

            Map<String, Integer> columns = mapColumns(sheet.getRow(headerRowNum));

            Integer dateCol = columns.get("date");
            Integer kmCol = columns.get("km");
            Integer kmInicialCol = columns.get("kmInicial");
            Integer kmFinalCol = columns.get("kmFinal");

            List<KmDayEntry> entries = new ArrayList<>();

            for (int i = headerRowNum + 1; i <= sheet.getLastRowNum(); i++) {

                Row row = sheet.getRow(i);

                if (row == null) continue;

                LocalDate date = SinistroXlsUtils.parseDate(
                        SinistroXlsUtils.getCellValue(row, dateCol)
                );

                if (date == null) continue;

                Double km = resolveKm(row, kmCol, kmInicialCol, kmFinalCol);

                if (km != null) {
                    entries.add(new KmDayEntry(date, km));
                }

            }

            return entries;

        }

    }

    private Double resolveKm(Row row, Integer kmCol, Integer kmInicialCol, Integer kmFinalCol) {

        if (kmCol != null) {
            Double km = SinistroXlsUtils.parseDouble(SinistroXlsUtils.getCellValue(row, kmCol));
            if (km != null) return km;
        }

        if (kmInicialCol != null && kmFinalCol != null) {

            Double inicial = SinistroXlsUtils.parseDouble(SinistroXlsUtils.getCellValue(row, kmInicialCol));
            Double finalKm = SinistroXlsUtils.parseDouble(SinistroXlsUtils.getCellValue(row, kmFinalCol));

            if (inicial != null && finalKm != null) {
                return finalKm - inicial;
            }

        }

        return null;

    }

    private int findHeaderRow(Sheet sheet) {

        for (int i = 0; i <= sheet.getLastRowNum(); i++) {

            Row row = sheet.getRow(i);

            if (row == null) continue;

            for (Cell0 cell : cells(row)) {

                String normalized = SinistroXlsUtils.normalize(cell.value());

                if (normalized.equals("data") || normalized.startsWith("dia")) {
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

            if (normalized.equals("data") || normalized.startsWith("dia")) {
                columns.putIfAbsent("date", cell.index());
            } else if (normalized.contains("percorrid") || normalized.contains("rodado")) {
                columns.putIfAbsent("km", cell.index());
            } else if (normalized.contains("km inicial") || normalized.equals("kminicial")) {
                columns.putIfAbsent("kmInicial", cell.index());
            } else if (normalized.contains("km final") || normalized.equals("kmfinal")) {
                columns.putIfAbsent("kmFinal", cell.index());
            } else if (normalized.contains("km") && !columns.containsKey("km")) {
                columns.putIfAbsent("km", cell.index());
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
