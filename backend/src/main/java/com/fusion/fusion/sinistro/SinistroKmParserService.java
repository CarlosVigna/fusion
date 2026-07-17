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
// Layout real confirmado:
//   Linhas 1-4 (índices 0-3): lixo/ignorar
//   Linha 5 (índice 4): cabeçalho — col A="Placa", col B="Dispositivo",
//                        col C+ = "01/07","02/07"..., última col = "Total"
//   Linha 6+ (índice 5+): dados por veículo
// KM por dia: decimal (ex: 70.533 = 70,533 km). Valores 0 ou 1 são ruído.
@Slf4j
@Service
public class SinistroKmParserService {

    // Extrai primeiro número de strings como "3,215 KM 0 metros"
    private static final Pattern FIRST_NUMBER = Pattern.compile("([\\d]+(?:[.,][\\d]+)?)");

    public List<KmDayEntry> parse(InputStream inputStream, String targetPlate) throws IOException {

        try (Workbook workbook = WorkbookFactory.create(inputStream)) {

            Sheet sheet = workbook.getSheetAt(0);

            // Header row: col A normalizada == "placa" (esperado no índice 4)
            int headerRowNum = -1;
            for (int i = 0; i <= Math.min(sheet.getLastRowNum(), 15); i++) {
                Row row = sheet.getRow(i);
                if (row == null) continue;
                if ("placa".equals(SinistroXlsUtils.normalize(SinistroXlsUtils.getCellValue(row, 0)))) {
                    headerRowNum = i;
                    break;
                }
            }

            if (headerRowNum == -1) {
                log.warn("[SINISTRO] Cabeçalho KM Mensal não encontrado (col A='Placa' não encontrada nas primeiras 15 linhas)");
                return List.of();
            }

            Row headerRow = sheet.getRow(headerRowNum);

            // Mapear colunas de data: col >= 2 (C) cujo header parse como LocalDate.
            // Parar ao encontrar "Total". LinkedHashMap preserva ordem cronológica.
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

                String rowPlate = SinistroXlsUtils.getCellValue(row, 0);
                if (rowPlate == null || rowPlate.isBlank()) continue;

                // Filtrar pela placa da análise (ignora traços/espaços/case)
                if (targetPlate != null && !targetPlate.isBlank()) {
                    String normRow    = rowPlate.replaceAll("[^A-Za-z0-9]", "").toUpperCase();
                    String normTarget = targetPlate.replaceAll("[^A-Za-z0-9]", "").toUpperCase();
                    if (!normRow.equals(normTarget)) continue;
                }

                for (Map.Entry<Integer, LocalDate> colEntry : dateCols.entrySet()) {
                    String raw = SinistroXlsUtils.getCellValue(row, colEntry.getKey());
                    Double km = parseKm(raw);
                    if (km != null && km > 0) {
                        entries.add(new KmDayEntry(colEntry.getValue(), km));
                    }
                }

            }

            log.info("[SINISTRO] KM Mensal: {} entradas parseadas para placa={}", entries.size(), targetPlate);
            return entries;

        }

    }

    private Double parseKm(String value) {

        if (value == null || value.isBlank()) return null;

        // Células numéricas chegam como "70.533" via String.valueOf — parse direto
        Double direct = SinistroXlsUtils.parseDouble(value);
        if (direct != null) return direct;

        // Fallback: string "3,215 KM 0 metros" — extrai o primeiro número
        Matcher m = FIRST_NUMBER.matcher(value);
        if (m.find()) {
            return SinistroXlsUtils.parseDouble(m.group(1));
        }

        return null;

    }

}
