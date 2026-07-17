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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

// Parser do export "KM Mensal" do Multiportal.
// Layout real (confirmado com arquivo real):
//   Linhas 1-3 (índices 0-2): ignorar
//   Linha 4 (índice 3): cabeçalho — col A="Placa", col B="Dispositivo",
//                        col C="01/06/2026", col D="02/06/2026", ..., última="Total"
//   Linha 5+ (índice 4+): dados — col A=placa, cols C+ = "3,215 KM 0 metros" ou número
@Slf4j
@Service
public class SinistroKmParserService {

    // Extrai o primeiro número (inteiro ou decimal com vírgula/ponto) de strings
    // como "3,215 KM 0 metros" → grupo 1 = "3,215" → parseDouble → 3.215
    private static final Pattern FIRST_NUMBER = Pattern.compile("([\\d]+(?:[.,][\\d]+)?)");

    public List<KmDayEntry> parse(InputStream inputStream) throws IOException {

        try (Workbook workbook = WorkbookFactory.create(inputStream)) {

            Sheet sheet = workbook.getSheetAt(0);

            // Header row: primeira linha onde col A normalizada == "placa"
            int headerRowNum = -1;
            for (int i = 0; i <= Math.min(sheet.getLastRowNum(), 10); i++) {
                Row row = sheet.getRow(i);
                if (row == null) continue;
                if ("placa".equals(SinistroXlsUtils.normalize(SinistroXlsUtils.getCellValue(row, 0)))) {
                    headerRowNum = i;
                    break;
                }
            }

            if (headerRowNum == -1) {
                log.warn("[SINISTRO] Cabeçalho KM Mensal não encontrado (nenhuma linha com col A='Placa' nas primeiras 10 linhas)");
                return List.of();
            }

            Row headerRow = sheet.getRow(headerRowNum);

            // Mapear colunas de data: col >= 2 (C) cujo header seja uma data válida.
            // Parar ao encontrar "Total" (última coluna de resumo).
            // Usar LinkedHashMap para preservar ordem cronológica.
            Map<Integer, LocalDate> dateCols = new LinkedHashMap<>();
            for (int col = 2; col < headerRow.getLastCellNum(); col++) {
                String header = SinistroXlsUtils.getCellValue(headerRow, col);
                if (header == null || header.isBlank()) continue;
                if ("total".equals(SinistroXlsUtils.normalize(header))) break;
                LocalDate date = SinistroXlsUtils.parseDate(header);
                if (date != null) {
                    dateCols.put(col, date);
                }
            }

            if (dateCols.isEmpty()) {
                log.warn("[SINISTRO] Nenhuma coluna de data encontrada no cabeçalho KM Mensal");
                return List.of();
            }

            log.debug("[SINISTRO] KM Mensal: {} colunas de data detectadas", dateCols.size());

            List<KmDayEntry> entries = new ArrayList<>();

            for (int i = headerRowNum + 1; i <= sheet.getLastRowNum(); i++) {

                Row row = sheet.getRow(i);
                if (row == null) continue;

                String plate = SinistroXlsUtils.getCellValue(row, 0);
                if (plate == null || plate.isBlank()) continue;

                for (Map.Entry<Integer, LocalDate> colEntry : dateCols.entrySet()) {
                    String raw = SinistroXlsUtils.getCellValue(row, colEntry.getKey());
                    Double km = parseKm(raw);
                    if (km != null && km > 0) {
                        entries.add(new KmDayEntry(colEntry.getValue(), km));
                    }
                }

            }

            log.info("[SINISTRO] KM Mensal: {} entradas parseadas", entries.size());
            return entries;

        }

    }

    private Double parseKm(String value) {

        if (value == null || value.isBlank()) return null;

        // Célula numérica vira "3.215" via String.valueOf — tenta direto primeiro
        Double direct = SinistroXlsUtils.parseDouble(value);
        if (direct != null) return direct;

        // String como "3,215 KM 0 metros" — extrai o primeiro número
        Matcher m = FIRST_NUMBER.matcher(value);
        if (m.find()) {
            return SinistroXlsUtils.parseDouble(m.group(1));
        }

        return null;

    }

}
