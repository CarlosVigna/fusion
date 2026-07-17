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

// Parser do export "Excesso de Velocidade" do Multiportal.
// Layout real confirmado:
//   Linha 1 (índice 0): título (ignorar)
//   Linha 2 (índice 1): vazia (ignorar)
//   Linha 3 (índice 2): cabeçalho — "Data Evento","Data Posição","Válido/Bloqueio",
//                        "Vel.","Válido","Online","Eventos","Motorista"
//   Linha 4 (índice 3): vazia (ignorar)
//   Linha 5+ (índice 4+): dados; última linha pode ser "Total: N"
// Arquivo vazio contém apenas "Total: 0" → retorna lista vazia (0 ocorrências).
// Cada arquivo cobre até 7 dias; o caller concatena os blocos antes de calcular.
@Slf4j
@Service
public class SinistroSpeedParserService {

    public List<SpeedEventEntry> parse(InputStream inputStream) throws IOException {

        try (Workbook workbook = WorkbookFactory.create(inputStream)) {

            Sheet sheet = workbook.getSheetAt(0);

            int headerRowNum = findHeaderRow(sheet);

            if (headerRowNum == -1) {
                log.warn("[SINISTRO] Cabeçalho Excesso de Velocidade não encontrado");
                return List.of();
            }

            Map<String, Integer> columns = mapColumns(sheet.getRow(headerRowNum));

            Integer dateCol  = columns.get("dateTime");
            Integer speedCol = columns.get("speed");

            List<SpeedEventEntry> entries = new ArrayList<>();

            for (int i = headerRowNum + 1; i <= sheet.getLastRowNum(); i++) {

                Row row = sheet.getRow(i);
                if (row == null) continue;

                // Linha "Total: N" — fim dos dados, interrompe
                String firstCell = SinistroXlsUtils.getCellValue(row, 0);
                if (firstCell != null && SinistroXlsUtils.normalize(firstCell).startsWith("total")) break;

                LocalDateTime dateTime = SinistroXlsUtils.parseDateTime(
                        SinistroXlsUtils.getCellValue(row, dateCol)
                );

                Double speed = SinistroXlsUtils.parseDouble(
                        SinistroXlsUtils.getCellValue(row, speedCol)
                );

                if (dateTime == null || speed == null) continue;

                entries.add(new SpeedEventEntry(dateTime, speed, null, null));

            }

            log.info("[SINISTRO] Excesso de Velocidade: {} ocorrências parseadas", entries.size());
            return entries;

        }

    }

    private int findHeaderRow(Sheet sheet) {

        for (int i = 0; i <= Math.min(sheet.getLastRowNum(), 10); i++) {

            Row row = sheet.getRow(i);
            if (row == null) continue;

            for (int col = row.getFirstCellNum(); col < row.getLastCellNum(); col++) {

                String normalized = SinistroXlsUtils.normalize(
                        SinistroXlsUtils.getCellValue(row, col)
                );

                // "Data Evento" ou "Vel." identificam o cabeçalho real
                if (normalized.contains("data evento") || normalized.startsWith("vel")) {
                    return i;
                }

            }

        }

        return -1;

    }

    private Map<String, Integer> mapColumns(Row headerRow) {

        Map<String, Integer> columns = new HashMap<>();

        for (int col = headerRow.getFirstCellNum(); col < headerRow.getLastCellNum(); col++) {

            String value = SinistroXlsUtils.getCellValue(headerRow, col);
            if (value == null || value.isBlank()) continue;

            String normalized = SinistroXlsUtils.normalize(value);

            // "Data Evento" → coluna de data/hora do evento
            if (normalized.contains("data evento") || (normalized.contains("data") && !columns.containsKey("dateTime"))) {
                columns.putIfAbsent("dateTime", col);
            }
            // "Vel." → velocidade registrada
            else if (normalized.startsWith("vel")) {
                columns.putIfAbsent("speed", col);
            }

        }

        return columns;

    }

}
