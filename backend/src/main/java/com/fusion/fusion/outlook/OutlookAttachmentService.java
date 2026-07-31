package com.fusion.fusion.outlook;

import com.fusion.fusion.letter.LetterRecord;
import com.fusion.fusion.letter.LetterRecordRepository;
import com.fusion.fusion.letter.LetterStatus;
import com.fusion.fusion.maintenance.MaintenanceRecord;
import com.fusion.fusion.maintenance.MaintenanceRecordRepository;
import com.fusion.fusion.maintenance.MaintenanceStatus;
import com.fusion.fusion.reports.MultiportalRow;
import com.fusion.fusion.reports.MultiportalSheetResponse;
import com.fusion.fusion.reports.MultiportalSheetService;
import com.fusion.fusion.signalcontrol.SignalControlResponse;
import com.fusion.fusion.signalcontrol.SignalControlService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Slf4j
@Service
@RequiredArgsConstructor
public class OutlookAttachmentService {

    private static final DateTimeFormatter DATE_FMT  = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter DT_FMT    = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
    private static final DateTimeFormatter FILE_DATE = DateTimeFormatter.ofPattern("dd-MM-yyyy");

    private final SignalControlService signalControlService;
    private final LetterRecordRepository letterRecordRepository;
    private final MaintenanceRecordRepository maintenanceRecordRepository;
    private final MultiportalSheetService multiportalSheetService;

    @Transactional(readOnly = true)
    public byte[] buildZip() throws Exception {

        String today = LocalDate.now(ZoneId.of("America/Sao_Paulo")).format(FILE_DATE);

        List<SignalControlResponse> signals = signalControlService.findAll(true);
        List<LetterRecord> activeLetters = letterRecordRepository.findByStatusOrderByDataEnvioDesc(LetterStatus.ATIVA);
        List<MaintenanceRecord> openMaintenances = maintenanceRecordRepository.findByStatusOrderByDataDesc(MaintenanceStatus.ABERTO);
        MultiportalSheetResponse multiportal = multiportalSheetService.build();

        ByteArrayOutputStream zipBaos = new ByteArrayOutputStream();

        try (ZipOutputStream zos = new ZipOutputStream(zipBaos)) {

            // SINAIS — sempre inclui
            zos.putNextEntry(new ZipEntry("SINAIS - " + today + ".xlsx"));
            zos.write(buildSinaisExcel(signals));
            zos.closeEntry();

            // CARTAS — só se houver ativas
            if (!activeLetters.isEmpty()) {
                zos.putNextEntry(new ZipEntry("CONTROLE CARTA DE SUSPENSÃO COBERTURA+5 DIAS.xlsx"));
                zos.write(buildCartasExcel(activeLetters));
                zos.closeEntry();
            }

            // MULTIPORTAL — sempre inclui
            zos.putNextEntry(new ZipEntry("CONTROLE DE VEÍCULOS MULTIPORTAL.xlsx"));
            zos.write(buildMultiportalExcel(multiportal));
            zos.closeEntry();

            // MANUTENÇÃO — só se houver abertas
            if (!openMaintenances.isEmpty()) {
                zos.putNextEntry(new ZipEntry("MANUTENÇÃO.xlsx"));
                zos.write(buildManutencaoExcel(openMaintenances));
                zos.closeEntry();
            }

        }

        log.info("[OUTLOOK-ZIP] Gerado: {} sinais, {} cartas, {} manutenções",
                signals.size(), activeLetters.size(), openMaintenances.size());

        return zipBaos.toByteArray();
    }

    // ── SINAIS ──────────────────────────────────────────────────────────────

    private byte[] buildSinaisExcel(List<SignalControlResponse> signals) throws Exception {

        try (Workbook wb = new XSSFWorkbook(); ByteArrayOutputStream baos = new ByteArrayOutputStream()) {

            Sheet sheet = wb.createSheet("Controle de Sinais");

            CellStyle headerStyle = headerStyle(wb);

            String[] headers = {
                "PLACA", "SEGURADO", "LINHA", "ÚLTIMA ATUALIZAÇÃO",
                "TEMPO ATRASADO", "FIM VIGÊNCIA", "STATUS APÓLICE", "ETAPA", "OBSERVAÇÃO"
            };
            createHeaderRow(sheet, headers, headerStyle);

            int rowIdx = 1;
            for (SignalControlResponse v : signals) {
                Row row = sheet.createRow(rowIdx++);
                row.createCell(0).setCellValue(safe(v.plate()));
                row.createCell(1).setCellValue(safe(v.insuredName()));
                row.createCell(2).setCellValue(safe(v.lineNumber()));
                row.createCell(3).setCellValue(v.lastCommunicationAt() != null
                        ? v.lastCommunicationAt().format(DT_FMT) : "");
                row.createCell(4).setCellValue(formatDelay(v.signalDelayMinutes()));
                row.createCell(5).setCellValue(v.policyEndDate() != null
                        ? v.policyEndDate().format(DATE_FMT) : "");
                row.createCell(6).setCellValue(safe(v.policyStatusDescricao()));
                row.createCell(7).setCellValue(stageLabel(v.suggestedStage()));
                row.createCell(8).setCellValue(v.lastObservation() != null
                        ? safe(v.lastObservation().text()) : "");
            }

            autoSize(sheet, headers.length);
            wb.write(baos);
            return baos.toByteArray();
        }
    }

    // ── CARTAS ──────────────────────────────────────────────────────────────

    private byte[] buildCartasExcel(List<LetterRecord> letters) throws Exception {

        try (Workbook wb = new XSSFWorkbook(); ByteArrayOutputStream baos = new ByteArrayOutputStream()) {

            Sheet sheet = wb.createSheet("Cartas de Suspensão");
            CellStyle headerStyle = headerStyle(wb);

            String[] headers = {
                "PLACA", "SEGURADO", "BASE", "MODELO",
                "ÚLTIMA POSIÇÃO", "DATA ENVIO", "FIM VIGÊNCIA",
                "OS ABERTA", "RETORNO SINAL", "OPERADOR"
            };
            createHeaderRow(sheet, headers, headerStyle);

            int rowIdx = 1;
            for (LetterRecord l : letters) {
                Row row = sheet.createRow(rowIdx++);
                row.createCell(0).setCellValue(l.getVehicle() != null ? safe(l.getVehicle().getPlate()) : "");
                row.createCell(1).setCellValue(safe(l.getInsuredName()));
                row.createCell(2).setCellValue(safe(l.getBase()));
                row.createCell(3).setCellValue(safe(l.getModelo()));
                row.createCell(4).setCellValue(l.getUltimaPosicao() != null
                        ? l.getUltimaPosicao().format(DATE_FMT) : "");
                row.createCell(5).setCellValue(l.getDataEnvio() != null
                        ? l.getDataEnvio().format(DATE_FMT) : "");
                row.createCell(6).setCellValue(l.getFimVigencia() != null
                        ? l.getFimVigencia().format(DATE_FMT) : "");
                row.createCell(7).setCellValue(safe(l.getOsAberta()));
                row.createCell(8).setCellValue(safe(l.getDataRetornoSinal()));
                row.createCell(9).setCellValue(safe(l.getOperador()));
            }

            autoSize(sheet, headers.length);
            wb.write(baos);
            return baos.toByteArray();
        }
    }

    // ── MULTIPORTAL ─────────────────────────────────────────────────────────

    private byte[] buildMultiportalExcel(MultiportalSheetResponse response) throws Exception {

        try (Workbook wb = new XSSFWorkbook(); ByteArrayOutputStream baos = new ByteArrayOutputStream()) {

            Sheet sheet = wb.createSheet("Multiportal");
            CellStyle headerStyle = headerStyle(wb);

            String[] headers = {
                "BLOCO", "PLACA", "LINHA", "DATA", "HORA",
                "SITUAÇÃO", "SEGURADO", "APÓLICE", "FIM VIGÊNCIA", "CPF/CNPJ"
            };
            createHeaderRow(sheet, headers, headerStyle);

            int rowIdx = 1;
            for (MultiportalRow r : response.blocks().getAllRows()) {
                Row row = sheet.createRow(rowIdx++);
                row.createCell(0).setCellValue(blockLabel(r.block()));
                row.createCell(1).setCellValue(safe(r.plate()));
                row.createCell(2).setCellValue(safe(r.numberStr()));
                row.createCell(3).setCellValue(r.lastCommunicationDate() != null
                        ? r.lastCommunicationDate().format(DATE_FMT) : "");
                row.createCell(4).setCellValue(r.lastCommunicationTime() != null
                        ? r.lastCommunicationTime().toString().substring(0, 5) : "");
                row.createCell(5).setCellValue(safe(r.status()));
                row.createCell(6).setCellValue(safe(r.insuredName()));
                row.createCell(7).setCellValue(safe(r.policyNumber()));
                row.createCell(8).setCellValue(r.policyEndDate() != null
                        ? r.policyEndDate().format(DATE_FMT) : "");
                row.createCell(9).setCellValue(safe(r.cpfCnpj()));
            }

            autoSize(sheet, headers.length);
            wb.write(baos);
            return baos.toByteArray();
        }
    }

    // ── MANUTENÇÃO ──────────────────────────────────────────────────────────

    private byte[] buildManutencaoExcel(List<MaintenanceRecord> maintenances) throws Exception {

        try (Workbook wb = new XSSFWorkbook(); ByteArrayOutputStream baos = new ByteArrayOutputStream()) {

            Sheet sheet = wb.createSheet("Manutenções");
            CellStyle headerStyle = headerStyle(wb);

            String[] headers = {
                "PLACA", "SEGURADO", "MODELO", "LOCAL POSIÇÃO",
                "CIDADE/UF", "DATA ABERTURA", "PRAZO ENCERRAMENTO", "BASE", "OPERADOR"
            };
            createHeaderRow(sheet, headers, headerStyle);

            int rowIdx = 1;
            for (MaintenanceRecord m : maintenances) {
                Row row = sheet.createRow(rowIdx++);
                row.createCell(0).setCellValue(m.getVehicle() != null ? safe(m.getVehicle().getPlate()) : "");
                row.createCell(1).setCellValue(safe(m.getInsuredName()));
                row.createCell(2).setCellValue(safe(m.getModelo()));
                row.createCell(3).setCellValue(safe(m.getLocalPosicao()));
                row.createCell(4).setCellValue(safe(m.getCidadeUf()));
                row.createCell(5).setCellValue(m.getData() != null ? m.getData().format(DATE_FMT) : "");
                row.createCell(6).setCellValue(m.getPrazoEncerramento() != null
                        ? m.getPrazoEncerramento().format(DATE_FMT) : "");
                row.createCell(7).setCellValue(safe(m.getBase()));
                row.createCell(8).setCellValue(safe(m.getOperador()));
            }

            autoSize(sheet, headers.length);
            wb.write(baos);
            return baos.toByteArray();
        }
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private void createHeaderRow(Sheet sheet, String[] headers, CellStyle style) {
        Row row = sheet.createRow(0);
        for (int i = 0; i < headers.length; i++) {
            Cell cell = row.createCell(i);
            cell.setCellValue(headers[i]);
            cell.setCellStyle(style);
        }
    }

    private CellStyle headerStyle(Workbook wb) {
        CellStyle style = wb.createCellStyle();
        Font font = wb.createFont();
        font.setBold(true);
        style.setFont(font);
        style.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        return style;
    }

    private void autoSize(Sheet sheet, int columns) {
        for (int i = 0; i < columns; i++) {
            sheet.autoSizeColumn(i);
        }
    }

    private String safe(String s) {
        return s != null ? s : "";
    }

    private String formatDelay(Integer minutes) {
        if (minutes == null) return "";
        long days = minutes / 1440;
        long hours = (minutes % 1440) / 60;
        if (days > 0) return days + "d " + hours + "h";
        return hours + "h";
    }

    private String stageLabel(com.fusion.fusion.signalcontrol.SignalStage stage) {
        if (stage == null) return "";
        return switch (stage) {
            case AWAITING_COMMAND    -> "1-2 dias";
            case CONTACT_INSURED     -> "3-4 dias";
            case SUSPENSION_PENDING  -> "5+ dias — suspensão";
            case MAINTENANCE_PENDING -> "5+ dias — manutenção";
            case SIGNAL_RETURNED     -> "Sinal retornou";
            default                  -> stage.name();
        };
    }

    private String blockLabel(String block) {
        if (block == null) return "";
        return switch (block) {
            case "operational"  -> "Operacional";
            case "kako"         -> "KAKO";
            case "tests"        -> "Testes";
            case "verification" -> "Verificação";
            default             -> block;
        };
    }

}
