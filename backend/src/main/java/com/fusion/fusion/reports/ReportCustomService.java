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
import com.fusion.fusion.vehicle.multiportal.device.Device;
import com.fusion.fusion.vehicle.multiportal.linkage.DeviceLinkage;
import com.fusion.fusion.vehicle.multiportal.linkage.DeviceLinkageRepository;
import com.lowagie.text.Document;
import com.lowagie.text.Font;
import com.lowagie.text.FontFactory;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.VerticalAlignment;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.*;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

// Gerador do "Relatorio Personalizado" — colunas e filtros escolhidos
// pelo usuario, ver CustomReportRequest. Mapeamento de campo -> fonte
// de dados documentado em FIELD_LABELS/resolveValue() abaixo.
@Service
@RequiredArgsConstructor
public class ReportCustomService {

    private final VehicleRepository vehicleRepository;

    private final DeviceLinkageRepository linkageRepository;

    private final OperationalSnapshotRepository snapshotRepository;

    private final PolicyRepository policyRepository;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private static final DateTimeFormatter DATETIME_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    // Ordem de exibicao — mesma ordem do array de exemplo no pedido.
    private static final LinkedHashMap<String, String> FIELD_LABELS = new LinkedHashMap<>();

    static {
        FIELD_LABELS.put("plate", "Placa");
        FIELD_LABELS.put("model", "Modelo");
        FIELD_LABELS.put("brand", "Marca");
        FIELD_LABELS.put("insuredName", "Segurado");
        FIELD_LABELS.put("cpfCnpj", "CPF/CNPJ");
        FIELD_LABELS.put("city", "Cidade");
        FIELD_LABELS.put("state", "Estado");
        FIELD_LABELS.put("zipCode", "CEP");
        FIELD_LABELS.put("policyNumber", "Nº Apólice");
        FIELD_LABELS.put("startDate", "Início Vigência");
        FIELD_LABELS.put("endDate", "Fim Vigência");
        FIELD_LABELS.put("policyStatus", "Status Apólice");
        FIELD_LABELS.put("lastCommunication", "Última Comunicação");
        FIELD_LABELS.put("signalDelayMinutes", "Atraso Sinal (min)");
        FIELD_LABELS.put("online", "Online");
        FIELD_LABELS.put("imei", "IMEI");
        FIELD_LABELS.put("chipLine", "Linha do Chip");
        FIELD_LABELS.put("equipment", "Equipamento");
        FIELD_LABELS.put("vehicleGroup", "Grupo");
    }

    private record RowBundle(Vehicle vehicle, Device device, OperationalSnapshot snapshot, Policy policy) {}

    public int countMatching(CustomReportRequest.CustomReportFilters filters) {
        return filterVehicles(filters).size();
    }

    public byte[] generate(CustomReportRequest request) {

        List<String> fields = request.fields() != null && !request.fields().isEmpty()
                ? request.fields()
                : new ArrayList<>(FIELD_LABELS.keySet());

        List<RowBundle> rows = filterVehicles(request.filters());

        List<List<String>> table = new ArrayList<>();

        for (RowBundle row : rows) {

            List<String> line = new ArrayList<>();

            for (String field : fields) {
                line.add(resolveValue(row, field));
            }

            table.add(line);

        }

        List<String> headers = fields.stream()
                .map(f -> FIELD_LABELS.getOrDefault(f, f))
                .toList();

        if ("PDF".equalsIgnoreCase(request.format())) {
            return generatePdf(headers, table);
        }

        return generateExcel(headers, table);

    }

    // Reaplica o mesmo criterio de "melhor apolice por placa" usado em
    // SignalControlService/VehicleGridService (status bom > ruim, depois
    // fim de vigencia mais recente) — evita placa com 2+ apolices
    // aparecer duplicada ou com a apolice errada escolhida.
    private List<RowBundle> filterVehicles(CustomReportRequest.CustomReportFilters filters) {

        CustomReportRequest.CustomReportFilters f = filters != null
                ? filters
                : new CustomReportRequest.CustomReportFilters(null, null, null, null, null, null);

        Map<UUID, DeviceLinkage> activeLinkageByVehicleId = new HashMap<>();
        for (DeviceLinkage linkage : linkageRepository.findAllActiveWithVehicleAndDevice()) {
            if (linkage.getVehicle() != null) {
                activeLinkageByVehicleId.putIfAbsent(linkage.getVehicle().getId(), linkage);
            }
        }

        Map<UUID, OperationalSnapshot> snapshotByVehicleId = new HashMap<>();
        for (OperationalSnapshot snapshot : snapshotRepository.findAll()) {
            if (snapshot.getVehicle() != null) {
                snapshotByVehicleId.put(snapshot.getVehicle().getId(), snapshot);
            }
        }

        Map<String, Policy> activePolicyByPlate = buildActivePolicyByPlate();

        Set<String> groupFilter = normalizedSet(f.groups());
        Set<String> policyStatusFilter = normalizedSet(f.policyStatus());
        String cityFilter = blankToNull(f.city());
        String stateFilter = blankToNull(f.state());
        String equipmentFilter = blankToNull(f.equipment());
        String commFilter = blankToNull(f.communicationStatus());

        List<RowBundle> result = new ArrayList<>();

        for (Vehicle vehicle : vehicleRepository.findAll()) {

            if (vehicle.getDeletedAt() != null) continue;

            if (!groupFilter.isEmpty()
                    && (vehicle.getVehicleGroup() == null
                        || !groupFilter.contains(vehicle.getVehicleGroup().name()))) {
                continue;
            }

            if (cityFilter != null
                    && (vehicle.getCity() == null
                        || !vehicle.getCity().toUpperCase().contains(cityFilter.toUpperCase()))) {
                continue;
            }

            if (stateFilter != null
                    && (vehicle.getState() == null
                        || !vehicle.getState().equalsIgnoreCase(stateFilter))) {
                continue;
            }

            DeviceLinkage linkage = activeLinkageByVehicleId.get(vehicle.getId());
            Device device = linkage != null ? linkage.getDevice() : null;

            if (equipmentFilter != null
                    && (device == null || device.getModel() == null
                        || !device.getModel().toUpperCase().contains(equipmentFilter.toUpperCase()))) {
                continue;
            }

            OperationalSnapshot snapshot = snapshotByVehicleId.get(vehicle.getId());

            if (commFilter != null && !matchesCommunicationFilter(snapshot, commFilter)) {
                continue;
            }

            Policy policy = vehicle.getPlate() != null
                    ? activePolicyByPlate.get(vehicle.getPlate().toUpperCase())
                    : null;

            if (!policyStatusFilter.isEmpty()) {
                String status = policy != null ? PolicyResponse.computeStatus(policy).name() : null;
                if (status == null || !policyStatusFilter.contains(status)) {
                    continue;
                }
            }

            result.add(new RowBundle(vehicle, device, snapshot, policy));

        }

        return result;

    }

    private boolean matchesCommunicationFilter(OperationalSnapshot snapshot, String filter) {

        boolean online = snapshot != null && Boolean.TRUE.equals(snapshot.getOnline());
        Integer delay = snapshot != null ? snapshot.getSignalDelayMinutes() : null;

        return switch (filter.toUpperCase()) {
            case "ONLINE" -> online;
            case "OFFLINE" -> !online;
            case "OFFLINE_24H" -> delay != null && delay > 1440;
            case "OFFLINE_48H" -> delay != null && delay > 2880;
            case "OFFLINE_7D" -> delay != null && delay > 10080;
            default -> true;
        };

    }

    private Map<String, Policy> buildActivePolicyByPlate() {

        Map<String, Policy> result = new HashMap<>();

        for (Policy policy : policyRepository.findAllActive()) {

            if (policy.getPlate() == null) continue;

            String plate = policy.getPlate().toUpperCase();
            PolicyStatus s = PolicyResponse.computeStatus(policy);
            Policy existing = result.get(plate);

            if (existing == null) {
                result.put(plate, policy);
            } else {
                PolicyStatus es = PolicyResponse.computeStatus(existing);
                boolean newGood = s == PolicyStatus.ACTIVE || s == PolicyStatus.EXPIRING || s == PolicyStatus.FUTURE;
                boolean existGood = es == PolicyStatus.ACTIVE || es == PolicyStatus.EXPIRING || es == PolicyStatus.FUTURE;
                if (newGood && !existGood) {
                    result.put(plate, policy);
                } else if (newGood && policy.getEndDate() != null
                        && (existing.getEndDate() == null || policy.getEndDate().isAfter(existing.getEndDate()))) {
                    result.put(plate, policy);
                }
            }

        }

        return result;

    }

    private String resolveValue(RowBundle row, String field) {

        Vehicle v = row.vehicle();
        Device d = row.device();
        OperationalSnapshot s = row.snapshot();
        Policy p = row.policy();

        return switch (field) {
            case "plate" -> v.getPlate();
            case "model" -> v.getVehicleModel() != null ? v.getVehicleModel() : (d != null ? d.getModel() : null);
            case "brand" -> v.getVehicleBrand();
            case "insuredName" -> v.getInsuredName() != null ? v.getInsuredName() : (p != null ? p.getInsuredName() : null);
            case "cpfCnpj" -> v.getCpfCnpj() != null ? v.getCpfCnpj() : (p != null ? p.getCpfCnpj() : null);
            case "city" -> v.getCity();
            case "state" -> v.getState();
            case "zipCode" -> v.getZipCode();
            case "policyNumber" -> p != null ? p.getPolicyNumber() : null;
            case "startDate" -> p != null && p.getStartDate() != null ? p.getStartDate().format(DATE_FMT) : null;
            case "endDate" -> p != null && p.getEndDate() != null ? p.getEndDate().format(DATE_FMT) : null;
            case "policyStatus" -> p != null ? translateStatus(PolicyResponse.computeStatus(p)) : null;
            case "lastCommunication" -> s != null && s.getLastCommunicationAt() != null
                    ? s.getLastCommunicationAt().format(DATETIME_FMT) : null;
            case "signalDelayMinutes" -> s != null && s.getSignalDelayMinutes() != null
                    ? String.valueOf(s.getSignalDelayMinutes()) : null;
            case "online" -> s != null && s.getOnline() != null ? (s.getOnline() ? "Sim" : "Não") : null;
            case "imei" -> d != null ? d.getImei() : null;
            case "chipLine" -> d != null ? d.getLineNumber() : null;
            case "equipment" -> d != null ? d.getModel() : null;
            case "vehicleGroup" -> v.getVehicleGroup() != null ? v.getVehicleGroup().name() : null;
            default -> null;
        };

    }

    private String translateStatus(PolicyStatus status) {
        return switch (status) {
            case ACTIVE -> "Vigente";
            case EXPIRING -> "Vencendo";
            case EXPIRED -> "Vencida";
            case CANCELLED -> "Cancelada";
            case CLOSED -> "Encerrada";
            case FUTURE -> "Futura";
            case SUPERSEDED -> "Substituída";
        };
    }

    private Set<String> normalizedSet(List<String> values) {
        if (values == null || values.isEmpty()) return Set.of();
        Set<String> result = new HashSet<>();
        for (String v : values) {
            if (v != null && !v.isBlank()) result.add(v.trim().toUpperCase());
        }
        return result;
    }

    private String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }

    // ==================== EXCEL ====================

    private byte[] generateExcel(List<String> headers, List<List<String>> rows) {

        try (XSSFWorkbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            XSSFSheet sheet = workbook.createSheet("Relatório");

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

            int numCols = headers.size();
            String dateStr = LocalDate.now().format(DATE_FMT);
            int rowNum = 0;

            XSSFRow titleRow = sheet.createRow(rowNum++);
            XSSFCell titleCell = titleRow.createCell(0);
            titleCell.setCellValue("Relatório Personalizado — " + dateStr);
            titleCell.setCellStyle(titleStyle);
            sheet.addMergedRegion(new CellRangeAddress(titleRow.getRowNum(), titleRow.getRowNum(), 0, Math.max(numCols - 1, 0)));
            titleRow.setHeightInPoints(28);
            rowNum++;

            XSSFRow headerRow = sheet.createRow(rowNum++);
            for (int i = 0; i < headers.size(); i++) {
                XSSFCell cell = headerRow.createCell(i);
                cell.setCellValue(headers.get(i));
                cell.setCellStyle(headerStyle);
            }
            headerRow.setHeightInPoints(18);

            int dataIdx = 0;
            for (List<String> line : rows) {
                XSSFRow row = sheet.createRow(rowNum++);
                XSSFCellStyle rowStyle = dataIdx % 2 == 0 ? evenStyle : oddStyle;
                for (int i = 0; i < line.size(); i++) {
                    XSSFCell cell = row.createCell(i);
                    cell.setCellValue(line.get(i) != null ? line.get(i) : "");
                    cell.setCellStyle(rowStyle);
                }
                dataIdx++;
            }

            XSSFRow totRow = sheet.createRow(rowNum++);
            XSSFCell totCell = totRow.createCell(0);
            totCell.setCellValue("Total: " + rows.size() + " veículo(s)");
            totCell.setCellStyle(totalStyle);
            sheet.addMergedRegion(new CellRangeAddress(totRow.getRowNum(), totRow.getRowNum(), 0, Math.max(numCols - 1, 0)));

            for (int i = 0; i < numCols; i++) {
                sheet.setColumnWidth(i, 18 * 256);
            }

            workbook.write(out);
            return out.toByteArray();

        } catch (Exception e) {
            throw new RuntimeException("Erro ao gerar relatório personalizado (Excel)", e);
        }

    }

    // ==================== PDF ====================
    // OpenPDF (com.lowagie.text.*) — mesma biblioteca ja usada no modulo
    // de Analise de Sinistro (SinistroReportFileService), unico gerador
    // de PDF existente no backend.

    private byte[] generatePdf(List<String> headers, List<List<String>> rows) {

        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            Document document = new Document(PageSize.A4.rotate(), 24, 24, 32, 32);
            PdfWriter.getInstance(document, out);
            document.open();

            Font titleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 14);
            Font headerFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8, Color.WHITE);
            Font cellFont = FontFactory.getFont(FontFactory.HELVETICA, 7);

            String dateStr = LocalDate.now().format(DATE_FMT);
            Paragraph title = new Paragraph("Relatório Personalizado — " + dateStr, titleFont);
            title.setSpacingAfter(10);
            document.add(title);

            PdfPTable table = new PdfPTable(Math.max(headers.size(), 1));
            table.setWidthPercentage(100);

            for (String header : headers) {
                PdfPCell cell = new PdfPCell(new Phrase(header, headerFont));
                cell.setBackgroundColor(new Color(0x1e, 0x3a, 0x8a));
                cell.setPadding(4);
                table.addCell(cell);
            }

            for (List<String> line : rows) {
                for (String value : line) {
                    PdfPCell cell = new PdfPCell(new Phrase(value != null ? value : "", cellFont));
                    cell.setPadding(3);
                    table.addCell(cell);
                }
            }

            document.add(table);

            Paragraph total = new Paragraph(
                    "Total: " + rows.size() + " veículo(s)",
                    FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9)
            );
            total.setSpacingBefore(10);
            document.add(total);

            document.close();

            return out.toByteArray();

        } catch (Exception e) {
            throw new RuntimeException("Erro ao gerar relatório personalizado (PDF)", e);
        }

    }

}
