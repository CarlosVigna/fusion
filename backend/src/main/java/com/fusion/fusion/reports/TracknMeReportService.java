package com.fusion.fusion.reports;

import com.fusion.fusion.operational.snapshot.OperationalSnapshot;
import com.fusion.fusion.operational.snapshot.OperationalSnapshotRepository;
import com.fusion.fusion.policy.Policy;
import com.fusion.fusion.policy.PolicyRepository;
import com.fusion.fusion.policy.PolicyResponse;
import com.fusion.fusion.policy.PolicyStatus;
import com.fusion.fusion.vehicle.Vehicle;
import com.fusion.fusion.vehicle.VehicleGroup;
import com.fusion.fusion.vehicle.VehicleRepository;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.VerticalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFCell;
import org.apache.poi.xssf.usermodel.XSSFCellStyle;
import org.apache.poi.xssf.usermodel.XSSFColor;
import org.apache.poi.xssf.usermodel.XSSFFont;
import org.apache.poi.xssf.usermodel.XSSFRow;
import org.apache.poi.xssf.usermodel.XSSFSheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

// Mesmo padrao visual do generateDeviceReportExcel() em
// MultiportalSheetService (azul #1d4ed8 / navy #1e3a8a) — nao existe
// logo em imagem (PNG/JPEG) no projeto, so o SVG do FusionLogo.jsx no
// frontend, que POI nao consegue embutir sem uma lib de rasterizacao
// (Batik) so pra isso. "Logo no topo" vira uma faixa de titulo com a
// mesma cor de marca, igual o relatorio de dispositivos ja faz.
@Service
@RequiredArgsConstructor
public class TracknMeReportService {

    private final VehicleRepository vehicleRepository;
    private final OperationalSnapshotRepository operationalSnapshotRepository;
    private final PolicyRepository policyRepository;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter DATETIME_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
    private static final ZoneId BRASILIA = ZoneId.of("America/Sao_Paulo");

    public byte[] generateExcel() {

        Map<UUID, OperationalSnapshot> snapshotByVehicleId = new HashMap<>();

        for (OperationalSnapshot snapshot : operationalSnapshotRepository.findAll()) {
            if (snapshot.getVehicle() != null) {
                snapshotByVehicleId.put(snapshot.getVehicle().getId(), snapshot);
            }
        }

        Map<String, Policy> policyByPlate = buildBestPolicyByPlate();

        List<Vehicle> vehicles = vehicleRepository.findAll().stream()
                .filter(v -> v.getVehicleGroup() == VehicleGroup.TRACKNME && v.getDeletedAt() == null)
                .sorted(Comparator.comparing(Vehicle::getPlate))
                .toList();

        try (XSSFWorkbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            XSSFSheet sheet = workbook.createSheet("TracknMe");

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

            String[] headers = {"Placa", "Última Posição", "Segurado", "Apólice", "Fim Vigência", "CPF/CNPJ"};
            int numCols = headers.length;
            String dateStr = LocalDate.now().format(DATE_FMT);
            int rowNum = 0;

            XSSFRow titleRow = sheet.createRow(rowNum++);
            XSSFCell titleCell = titleRow.createCell(0);
            titleCell.setCellValue("FUSION — Relatório TracknMe — " + dateStr);
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

            for (Vehicle vehicle : vehicles) {

                OperationalSnapshot snapshot = snapshotByVehicleId.get(vehicle.getId());
                Policy policy = policyByPlate.get(vehicle.getPlate().toUpperCase());

                String insuredName = policy != null && policy.getInsuredName() != null
                        ? policy.getInsuredName()
                        : vehicle.getInsuredName();

                String lastPosition = formatBrasilia(snapshot != null ? snapshot.getLastCommunicationAt() : null);

                String endDate = policy != null && policy.getEndDate() != null
                        ? policy.getEndDate().format(DATE_FMT)
                        : null;

                XSSFRow dataRow = sheet.createRow(rowNum++);
                XSSFCellStyle rowStyle = dataIdx % 2 == 0 ? evenStyle : oddStyle;

                setCell(dataRow, 0, vehicle.getPlate(), rowStyle);
                setCell(dataRow, 1, lastPosition, rowStyle);
                setCell(dataRow, 2, insuredName, rowStyle);
                setCell(dataRow, 3, policy != null ? policy.getPolicyNumber() : null, rowStyle);
                setCell(dataRow, 4, endDate, rowStyle);
                setCell(dataRow, 5, policy != null ? policy.getCpfCnpj() : null, rowStyle);

                dataIdx++;

            }

            XSSFRow totRow = sheet.createRow(rowNum++);
            XSSFCell totCell = totRow.createCell(0);
            totCell.setCellValue("Total: " + vehicles.size() + " veículo(s)");
            totCell.setCellStyle(totalStyle);
            sheet.addMergedRegion(new CellRangeAddress(totRow.getRowNum(), totRow.getRowNum(), 0, numCols - 1));

            int[] colWidths = {14, 20, 32, 18, 14, 18};
            for (int i = 0; i < colWidths.length; i++) {
                sheet.setColumnWidth(i, colWidths[i] * 256);
            }

            workbook.write(out);
            return out.toByteArray();

        } catch (Exception e) {
            throw new RuntimeException("Erro ao gerar relatório TracknMe", e);
        }

    }

    private void setCell(XSSFRow row, int col, String value, XSSFCellStyle style) {
        XSSFCell cell = row.createCell(col);
        cell.setCellValue(value != null ? value : "");
        cell.setCellStyle(style);
    }

    // lastCommunicationAt fica salvo em UTC (ver comentario em
    // TracknMeSyncService.parseDateTime()) — formatar direto sem
    // converter mostrava a hora UTC como se fosse Brasilia.
    private String formatBrasilia(LocalDateTime utc) {

        if (utc == null) {
            return null;
        }

        return utc.atZone(ZoneOffset.UTC)
                .withZoneSameInstant(BRASILIA)
                .toLocalDateTime()
                .format(DATETIME_FMT);

    }

    // Mesma logica de "melhor apolice por placa" ja duplicada em
    // VehicleGridService e MultiportalSheetService — sem utilitario
    // compartilhado pra isso no projeto ainda, mantendo o padrao
    // existente em vez de introduzir um novo agora.
    private Map<String, Policy> buildBestPolicyByPlate() {

        Map<String, Policy> result = new HashMap<>();

        for (Policy policy : policyRepository.findAll()) {

            if (policy.getPlate() == null) continue;

            String plate = policy.getPlate().toUpperCase();
            PolicyStatus status = PolicyResponse.computeStatus(policy);
            Policy existing = result.get(plate);

            if (existing == null) {
                result.put(plate, policy);
                continue;
            }

            PolicyStatus existingStatus = PolicyResponse.computeStatus(existing);
            boolean newGood = isCurrentStatus(status);
            boolean existingGood = isCurrentStatus(existingStatus);

            if (newGood && !existingGood) {
                result.put(plate, policy);
            } else if (newGood && policy.getEndDate() != null
                    && (existing.getEndDate() == null || policy.getEndDate().isAfter(existing.getEndDate()))) {
                result.put(plate, policy);
            }

        }

        return result;

    }

    private boolean isCurrentStatus(PolicyStatus status) {
        return status == PolicyStatus.ACTIVE
                || status == PolicyStatus.EXPIRING
                || status == PolicyStatus.FUTURE;
    }

}
