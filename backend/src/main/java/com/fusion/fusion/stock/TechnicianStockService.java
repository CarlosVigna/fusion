package com.fusion.fusion.stock;

import com.fusion.fusion.common.exception.ResourceNotFoundException;
import com.fusion.fusion.technician.Technician;
import com.fusion.fusion.technician.TechnicianRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.VerticalAlignment;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.*;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class TechnicianStockService {

    private final TechnicianStockRepository stockRepository;

    private final StockPendingConfirmationRepository pendingRepository;

    private final TechnicianRepository technicianRepository;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    public TechnicianStockResponse addToStock(UUID technicianId, StockRequest request) {

        Technician technician = technicianRepository.findById(technicianId)
                .orElseThrow(() -> new ResourceNotFoundException("Técnico não encontrado"));

        TechnicianStock stock = TechnicianStock.builder()
                .technician(technician)
                .imei(request.imei())
                .chipLine(request.chipLine())
                .model(request.model())
                .receivedAt(request.receivedAt())
                .sentAt(request.sentAt())
                .status(StockStatus.EM_ESTOQUE)
                .build();

        return TechnicianStockResponse.from(stockRepository.save(stock));

    }

    public TechnicianStockResponse confirmInstallation(Long stockId, String plate, LocalDate installedAt) {

        TechnicianStock stock = stockRepository.findById(stockId)
                .orElseThrow(() -> new ResourceNotFoundException("Equipamento não encontrado no estoque"));

        stock.setInstalledPlate(plate);
        stock.setInstalledAt(installedAt != null ? installedAt : LocalDate.now(ZoneOffset.UTC));
        stock.setStatus(StockStatus.INSTALADO);

        TechnicianStock saved = stockRepository.save(stock);

        pendingRepository.findFirstByStockAndConfirmedFalse(stock).ifPresent(pending -> {
            pending.setConfirmed(true);
            pending.setConfirmedAt(LocalDateTime.now(ZoneOffset.UTC));
            pendingRepository.save(pending);
        });

        return TechnicianStockResponse.from(saved);

    }

    public TechnicianStockResponse markAsReturned(Long stockId) {

        TechnicianStock stock = stockRepository.findById(stockId)
                .orElseThrow(() -> new ResourceNotFoundException("Equipamento não encontrado no estoque"));

        stock.setStatus(StockStatus.DEVOLVIDO);

        return TechnicianStockResponse.from(stockRepository.save(stock));

    }

    public List<TechnicianStockResponse> findByTechnician(UUID technicianId) {

        return stockRepository.findByTechnicianIdOrderByCreatedAtDesc(technicianId)
                .stream()
                .map(TechnicianStockResponse::from)
                .toList();

    }

    public List<TechnicianStockResponse> findAll() {

        return stockRepository.findAll()
                .stream()
                .sorted(Comparator.comparing(
                        (TechnicianStock s) -> s.getTechnician() != null ? s.getTechnician().getName() : "",
                        String.CASE_INSENSITIVE_ORDER
                ))
                .map(TechnicianStockResponse::from)
                .toList();

    }

    // Chamado pelo motor operacional apos atualizar o snapshot de um
    // veiculo (ver OperationalStateEngineService) — se o IMEI do
    // dispositivo ativo bate com um equipamento EM_ESTOQUE de algum
    // tecnico, isso e' forte indicio de que acabou de ser instalado.
    public void checkImeiOnPositioning(String imei, String plate) {

        if (imei == null || imei.isBlank()) {
            return;
        }

        var stockOpt = stockRepository.findFirstByImeiAndStatusOrderByCreatedAtDesc(imei, StockStatus.EM_ESTOQUE);

        if (stockOpt.isEmpty()) {
            log.warn("[STOCK] IMEI {} posicionou em {} mas não está em nenhum estoque de técnico", imei, plate);
            return;
        }

        TechnicianStock stock = stockOpt.get();

        if (pendingRepository.findFirstByStockAndConfirmedFalse(stock).isPresent()) {
            return;
        }

        StockPendingConfirmation pending = StockPendingConfirmation.builder()
                .stock(stock)
                .plate(plate)
                .detectedAt(LocalDateTime.now(ZoneOffset.UTC))
                .confirmed(false)
                .build();

        pendingRepository.save(pending);

        log.info("[STOCK] Equipamento IMEI {} (técnico {}) detectado posicionando em {} — aguardando confirmação",
                imei, stock.getTechnician() != null ? stock.getTechnician().getName() : "?", plate);

    }

    public void dismissPendingConfirmation(Long pendingId) {

        StockPendingConfirmation pending = pendingRepository.findById(pendingId)
                .orElseThrow(() -> new ResourceNotFoundException("Confirmação pendente não encontrada"));

        pending.setConfirmed(true);
        pending.setConfirmedAt(LocalDateTime.now(ZoneOffset.UTC));
        pending.setConfirmedBy("IGNORADO");

        pendingRepository.save(pending);

    }

    public List<StockPendingConfirmationResponse> findPendingConfirmations() {

        return pendingRepository.findByConfirmedFalseOrderByDetectedAtDesc()
                .stream()
                .map(StockPendingConfirmationResponse::from)
                .toList();

    }

    // Mesmo padrao visual dos outros relatorios (TracknMeReportService) —
    // azul #1d4ed8 / navy #1e3a8a.
    public byte[] exportExcel() {

        List<TechnicianStock> allStock = stockRepository.findAll().stream()
                .sorted(Comparator.comparing(
                        (TechnicianStock s) -> s.getTechnician() != null ? s.getTechnician().getName() : "",
                        String.CASE_INSENSITIVE_ORDER
                ))
                .toList();

        try (XSSFWorkbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            XSSFSheet sheet = workbook.createSheet("Estoque");

            XSSFColor blue = new XSSFColor(new byte[]{(byte) 0x1d, (byte) 0x4e, (byte) 0xd8}, null);
            XSSFColor navy = new XSSFColor(new byte[]{(byte) 0x1e, (byte) 0x3a, (byte) 0x8a}, null);
            XSSFColor lgray = new XSSFColor(new byte[]{(byte) 0xf3, (byte) 0xf4, (byte) 0xf6}, null);

            XSSFCellStyle titleStyle = workbook.createCellStyle();
            XSSFFont titleFont = workbook.createFont();
            titleFont.setBold(true);
            titleFont.setFontHeightInPoints((short) 13);
            titleFont.setColor(IndexedColors.WHITE.getIndex());
            titleStyle.setFont(titleFont);
            titleStyle.setFillForegroundColor(blue);
            titleStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            titleStyle.setAlignment(HorizontalAlignment.LEFT);
            titleStyle.setVerticalAlignment(VerticalAlignment.CENTER);

            XSSFCellStyle headerStyle = workbook.createCellStyle();
            XSSFFont headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerFont.setColor(IndexedColors.WHITE.getIndex());
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(navy);
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            headerStyle.setAlignment(HorizontalAlignment.CENTER);
            headerStyle.setVerticalAlignment(VerticalAlignment.CENTER);

            XSSFCellStyle evenStyle = workbook.createCellStyle();

            XSSFCellStyle oddStyle = workbook.createCellStyle();
            oddStyle.setFillForegroundColor(lgray);
            oddStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            XSSFCellStyle totalStyle = workbook.createCellStyle();
            XSSFFont totalFont = workbook.createFont();
            totalFont.setBold(true);
            totalStyle.setFont(totalFont);

            String[] headers = {
                    "Técnico", "IMEI", "Linha", "Modelo", "Recebido", "Enviado",
                    "Status", "Instalado em", "Placa instalada"
            };
            int numCols = headers.length;
            String dateStr = LocalDate.now().format(DATE_FMT);
            int rowNum = 0;

            XSSFRow titleRow = sheet.createRow(rowNum++);
            XSSFCell titleCell = titleRow.createCell(0);
            titleCell.setCellValue("FUSION — Estoque de Equipamentos — " + dateStr);
            titleCell.setCellStyle(titleStyle);
            sheet.addMergedRegion(new CellRangeAddress(titleRow.getRowNum(), titleRow.getRowNum(), 0, numCols - 1));
            titleRow.setHeightInPoints(28);
            rowNum++;

            XSSFRow headerRow = sheet.createRow(rowNum++);
            for (int i = 0; i < headers.length; i++) {
                XSSFCell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
            }
            headerRow.setHeightInPoints(18);

            int dataIdx = 0;

            for (TechnicianStock s : allStock) {

                XSSFRow row = sheet.createRow(rowNum++);
                XSSFCellStyle rowStyle = dataIdx % 2 == 0 ? evenStyle : oddStyle;

                setCell(row, 0, s.getTechnician() != null ? s.getTechnician().getName() : "", rowStyle);
                setCell(row, 1, s.getImei(), rowStyle);
                setCell(row, 2, s.getChipLine(), rowStyle);
                setCell(row, 3, s.getModel(), rowStyle);
                setCell(row, 4, s.getReceivedAt() != null ? s.getReceivedAt().format(DATE_FMT) : "", rowStyle);
                setCell(row, 5, s.getSentAt() != null ? s.getSentAt().format(DATE_FMT) : "", rowStyle);
                setCell(row, 6, s.getStatus() != null ? s.getStatus().name() : "", rowStyle);
                setCell(row, 7, s.getInstalledAt() != null ? s.getInstalledAt().format(DATE_FMT) : "", rowStyle);
                setCell(row, 8, s.getInstalledPlate(), rowStyle);

                dataIdx++;

            }

            XSSFRow totRow = sheet.createRow(rowNum++);
            XSSFCell totCell = totRow.createCell(0);
            totCell.setCellValue("Total: " + allStock.size() + " equipamento(s)");
            totCell.setCellStyle(totalStyle);
            sheet.addMergedRegion(new CellRangeAddress(totRow.getRowNum(), totRow.getRowNum(), 0, numCols - 1));

            int[] colWidths = {24, 18, 14, 18, 12, 12, 14, 14, 16};
            for (int i = 0; i < colWidths.length; i++) {
                sheet.setColumnWidth(i, colWidths[i] * 256);
            }

            workbook.write(out);
            return out.toByteArray();

        } catch (Exception e) {
            throw new RuntimeException("Erro ao gerar relatório de estoque", e);
        }

    }

    private void setCell(XSSFRow row, int col, String value, XSSFCellStyle style) {
        XSSFCell cell = row.createCell(col);
        cell.setCellValue(value != null ? value : "");
        cell.setCellStyle(style);
    }

}
