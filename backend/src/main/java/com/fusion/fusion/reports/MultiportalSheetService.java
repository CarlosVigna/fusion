package com.fusion.fusion.reports;

import com.fusion.fusion.vehicle.multiportal.device.Device;
import com.fusion.fusion.letter.LetterRecord;
import com.fusion.fusion.letter.LetterRecordRepository;
import com.fusion.fusion.letter.LetterStatus;
import com.fusion.fusion.observation.VehicleObservation;
import com.fusion.fusion.observation.VehicleObservationService;
import com.fusion.fusion.operational.snapshot.OperationalSnapshot;
import com.fusion.fusion.operational.snapshot.OperationalSnapshotRepository;
import com.fusion.fusion.policy.Policy;
import com.fusion.fusion.policy.PolicyRepository;
import com.fusion.fusion.policy.PolicyResponse;
import com.fusion.fusion.policy.PolicyStatus;
import com.fusion.fusion.vehicle.Vehicle;
import com.fusion.fusion.vehicle.VehicleGroup;
import com.fusion.fusion.vehicle.VehicleRepository;
import com.fusion.fusion.vehicle.multiportal.linkage.DeviceLinkage;
import com.fusion.fusion.vehicle.multiportal.linkage.DeviceLinkageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.VerticalAlignment;
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
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class MultiportalSheetService {


    private final VehicleRepository vehicleRepository;
    private final DeviceLinkageRepository deviceLinkageRepository;
    private final OperationalSnapshotRepository operationalSnapshotRepository;
    private final VehicleObservationService vehicleObservationService;
    private final LetterRecordRepository letterRecordRepository;
    private final PolicyRepository policyRepository;

    public MultiportalSheetResponse build() {

        Map<UUID, OperationalSnapshot> snapshotByVehicleId = new HashMap<>();

        for (OperationalSnapshot snapshot : operationalSnapshotRepository.findAll()) {
            if (snapshot.getVehicle() != null) {
                snapshotByVehicleId.put(snapshot.getVehicle().getId(), snapshot);
            }
        }

        Map<UUID, DeviceLinkage> activeLinkageByVehicleId = new HashMap<>();

        for (DeviceLinkage linkage : deviceLinkageRepository.findAllActiveWithVehicleAndDevice()) {
            if (linkage.getVehicle() != null) {
                activeLinkageByVehicleId.putIfAbsent(linkage.getVehicle().getId(), linkage);
            }
        }

        Map<UUID, VehicleObservation> latestObservationByVehicleId =
                vehicleObservationService.findLatestByVehicleId();

        Map<UUID, LetterRecord> activeLetterByVehicleId = new HashMap<>();

        for (LetterRecord letter : letterRecordRepository.findByStatusOrderByDataEnvioDesc(LetterStatus.ATIVA)) {
            if (letter.getVehicle() != null) {
                activeLetterByVehicleId.putIfAbsent(letter.getVehicle().getId(), letter);
            }
        }

        Map<String, Policy> policyByPlate = buildBestPolicyByPlate();

        List<Vehicle> allVehicles = vehicleRepository.findAll();

        List<Vehicle> activeVehicles = allVehicles.stream()
                .filter(vehicle -> vehicle.getDeletedAt() == null)
                .sorted(Comparator.comparing(Vehicle::getPlate))
                .toList();

        List<Vehicle> operationalVehicles = activeVehicles.stream()
                .filter(vehicle -> Boolean.TRUE.equals(vehicle.getHasEverCommunicated())
                        && vehicle.getVehicleGroup() == VehicleGroup.OPERATIONAL)
                .toList();

        List<Vehicle> kakoVehicles = activeVehicles.stream()
                .filter(vehicle -> vehicle.getVehicleGroup() == VehicleGroup.KAKO)
                .toList();

        log.info("[MULTIPORTAL-SHEET] Total veículos: {}", allVehicles.size());

        List<Vehicle> testVehicles = allVehicles.stream()
                .filter(v -> v.getVehicleGroup() == VehicleGroup.TEST)
                .sorted(Comparator.comparing(Vehicle::getPlate))
                .toList();
        log.info("[MULTIPORTAL-SHEET] Testes (group=TEST): {} | placas: {}",
                testVehicles.size(),
                testVehicles.stream().map(Vehicle::getPlate).toList());

        List<Vehicle> verificationVehicles = activeVehicles.stream()
                .filter(vehicle -> {
                    OperationalSnapshot snapshot = snapshotByVehicleId.get(vehicle.getId());
                    boolean noCommunication = snapshot == null || snapshot.getLastCommunicationAt() == null;
                    boolean noPolicy = policyByPlate.get(vehicle.getPlate().toUpperCase()) == null;
                    return noCommunication || noPolicy;
                })
                .toList();

        MultiportalBlocks blocks = new MultiportalBlocks(
                buildRows(operationalVehicles, "operational", snapshotByVehicleId, activeLinkageByVehicleId, latestObservationByVehicleId, activeLetterByVehicleId, policyByPlate),
                buildRows(kakoVehicles, "kako", snapshotByVehicleId, activeLinkageByVehicleId, latestObservationByVehicleId, activeLetterByVehicleId, policyByPlate),
                buildRows(testVehicles, "tests", snapshotByVehicleId, activeLinkageByVehicleId, latestObservationByVehicleId, activeLetterByVehicleId, policyByPlate),
                buildRows(verificationVehicles, "verification", snapshotByVehicleId, activeLinkageByVehicleId, latestObservationByVehicleId, activeLetterByVehicleId, policyByPlate)
        );

        return new MultiportalSheetResponse(blocks, LocalDateTime.now(ZoneOffset.UTC));

    }

    private List<MultiportalRow> buildRows(
            List<Vehicle> vehicles,
            String blockKey,
            Map<UUID, OperationalSnapshot> snapshotByVehicleId,
            Map<UUID, DeviceLinkage> activeLinkageByVehicleId,
            Map<UUID, VehicleObservation> latestObservationByVehicleId,
            Map<UUID, LetterRecord> activeLetterByVehicleId,
            Map<String, Policy> policyByPlate
    ) {

        List<MultiportalRow> rows = new ArrayList<>();

        for (Vehicle vehicle : vehicles) {

            rows.add(buildRow(
                    vehicle,
                    blockKey,
                    snapshotByVehicleId.get(vehicle.getId()),
                    activeLinkageByVehicleId.get(vehicle.getId()),
                    latestObservationByVehicleId.get(vehicle.getId()),
                    activeLetterByVehicleId.get(vehicle.getId()),
                    policyByPlate.get(vehicle.getPlate().toUpperCase())
            ));

        }

        return rows;

    }

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

    private static final Map<String, String> DEVICE_BLOCK_LABELS = Map.of(
            "operational", "Operacionais",
            "kako", "KAKO",
            "tests", "Testes",
            "verification", "Verificação"
    );

    public byte[] generateDeviceReportExcel() {

        Map<UUID, DeviceLinkage> linkageByVehicleId = new HashMap<>();
        for (DeviceLinkage linkage : deviceLinkageRepository.findAllActiveWithVehicleAndDevice()) {
            if (linkage.getVehicle() != null) {
                linkageByVehicleId.putIfAbsent(linkage.getVehicle().getId(), linkage);
            }
        }

        Map<UUID, OperationalSnapshot> snapshotByVehicleId = new HashMap<>();
        for (OperationalSnapshot snapshot : operationalSnapshotRepository.findAll()) {
            if (snapshot.getVehicle() != null) {
                snapshotByVehicleId.put(snapshot.getVehicle().getId(), snapshot);
            }
        }

        Map<String, Policy> policyByPlate = buildBestPolicyByPlate();

        List<Vehicle> allVehicles = vehicleRepository.findAll();
        List<Vehicle> activeVehicles = allVehicles.stream()
                .filter(v -> v.getDeletedAt() == null)
                .sorted(Comparator.comparing(Vehicle::getPlate))
                .toList();

        List<Vehicle> operational = activeVehicles.stream()
                .filter(v -> Boolean.TRUE.equals(v.getHasEverCommunicated())
                        && v.getVehicleGroup() == VehicleGroup.OPERATIONAL)
                .toList();
        List<Vehicle> kako = activeVehicles.stream()
                .filter(v -> v.getVehicleGroup() == VehicleGroup.KAKO)
                .toList();
        List<Vehicle> tests = allVehicles.stream()
                .filter(v -> v.getVehicleGroup() == VehicleGroup.TEST)
                .sorted(Comparator.comparing(Vehicle::getPlate))
                .toList();
        List<Vehicle> verification = activeVehicles.stream()
                .filter(v -> {
                    OperationalSnapshot s = snapshotByVehicleId.get(v.getId());
                    boolean noCommunication = s == null || s.getLastCommunicationAt() == null;
                    boolean noPolicy = policyByPlate.get(v.getPlate().toUpperCase()) == null;
                    return noCommunication || noPolicy;
                })
                .toList();

        Map<String, List<Vehicle>> blocks = new LinkedHashMap<>();
        blocks.put("operational", operational);
        blocks.put("kako", kako);
        blocks.put("tests", tests);
        blocks.put("verification", verification);

        try (XSSFWorkbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            XSSFSheet sheet = workbook.createSheet("Dispositivos");

            XSSFColor blue  = new XSSFColor(new byte[]{(byte) 0x1d, (byte) 0x4e, (byte) 0xd8}, null);
            XSSFColor navy  = new XSSFColor(new byte[]{(byte) 0x1e, (byte) 0x3a, (byte) 0x8a}, null);
            XSSFColor lgray = new XSSFColor(new byte[]{(byte) 0xf3, (byte) 0xf4, (byte) 0xf6}, null);

            XSSFCellStyle titleStyle = workbook.createCellStyle();
            XSSFFont titleFont = workbook.createFont();
            titleFont.setBold(true);
            titleFont.setFontHeightInPoints((short) 13);
            titleStyle.setFont(titleFont);
            titleStyle.setAlignment(HorizontalAlignment.LEFT);
            titleStyle.setVerticalAlignment(VerticalAlignment.CENTER);

            XSSFCellStyle blockStyle = workbook.createCellStyle();
            XSSFFont blockFont = workbook.createFont();
            blockFont.setBold(true);
            blockFont.setFontHeightInPoints((short) 12);
            blockFont.setColor(IndexedColors.WHITE.getIndex());
            blockStyle.setFont(blockFont);
            blockStyle.setFillForegroundColor(blue);
            blockStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            blockStyle.setAlignment(HorizontalAlignment.LEFT);
            blockStyle.setVerticalAlignment(VerticalAlignment.CENTER);

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

            String[] headers = {"Placa", "Segurado", "Número", "Número STR", "Serial Chip 1", "Operadora", "Linha Chip 1"};
            int numCols = headers.length;
            String dateStr = LocalDate.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy"));
            int rowNum = 0;

            XSSFRow titleRow = sheet.createRow(rowNum++);
            XSSFCell titleCell = titleRow.createCell(0);
            titleCell.setCellValue("Relatório de Dispositivos — " + dateStr);
            titleCell.setCellStyle(titleStyle);
            sheet.addMergedRegion(new CellRangeAddress(titleRow.getRowNum(), titleRow.getRowNum(), 0, numCols - 1));
            titleRow.setHeightInPoints(28);
            rowNum++;

            for (Map.Entry<String, List<Vehicle>> entry : blocks.entrySet()) {
                String blockKey = entry.getKey();
                List<Vehicle> vehicles = entry.getValue();
                String label = DEVICE_BLOCK_LABELS.get(blockKey);

                XSSFRow sepRow = sheet.createRow(rowNum++);
                XSSFCell sepCell = sepRow.createCell(0);
                sepCell.setCellValue(label + " — " + vehicles.size() + " veículo(s)");
                sepCell.setCellStyle(blockStyle);
                sheet.addMergedRegion(new CellRangeAddress(sepRow.getRowNum(), sepRow.getRowNum(), 0, numCols - 1));
                sepRow.setHeightInPoints(22);

                XSSFRow headerRow = sheet.createRow(rowNum++);
                for (int i = 0; i < headers.length; i++) {
                    XSSFCell cell = headerRow.createCell(i);
                    cell.setCellValue(headers[i]);
                    cell.setCellStyle(headerStyle);
                }
                headerRow.setHeightInPoints(18);

                int dataIdx = 0;
                for (Vehicle vehicle : vehicles) {
                    DeviceLinkage linkage = linkageByVehicleId.get(vehicle.getId());
                    Device device = linkage != null ? linkage.getDevice() : null;
                    Policy policy = policyByPlate.get(vehicle.getPlate().toUpperCase());
                    String insuredName = policy != null && policy.getInsuredName() != null
                            ? policy.getInsuredName() : vehicle.getInsuredName();

                    XSSFRow dataRow = sheet.createRow(rowNum++);
                    XSSFCellStyle rowStyle = dataIdx % 2 == 0 ? evenStyle : oddStyle;

                    setDeviceCell(dataRow, 0, vehicle.getPlate(), rowStyle);
                    setDeviceCell(dataRow, 1, insuredName, rowStyle);
                    setDeviceCell(dataRow, 2, device != null ? device.getNumber() : null, rowStyle);
                    setDeviceCell(dataRow, 3, device != null ? device.getNumberStr() : null, rowStyle);
                    setDeviceCell(dataRow, 4, device != null ? device.getSerialChip1() : null, rowStyle);
                    setDeviceCell(dataRow, 5, device != null ? device.getOperator() : null, rowStyle);
                    setDeviceCell(dataRow, 6, device != null ? device.getLineNumber() : null, rowStyle);

                    dataIdx++;
                }

                XSSFRow totRow = sheet.createRow(rowNum++);
                XSSFCell totCell = totRow.createCell(0);
                totCell.setCellValue("Total: " + vehicles.size() + " veículo(s)");
                totCell.setCellStyle(totalStyle);
                sheet.addMergedRegion(new CellRangeAddress(totRow.getRowNum(), totRow.getRowNum(), 0, numCols - 1));

                rowNum++;
            }

            int[] colWidths = {14, 32, 14, 14, 18, 18, 16};
            for (int i = 0; i < colWidths.length; i++) {
                sheet.setColumnWidth(i, colWidths[i] * 256);
            }

            workbook.write(out);
            return out.toByteArray();

        } catch (Exception e) {
            throw new RuntimeException("Erro ao gerar relatório de dispositivos", e);
        }

    }

    private void setDeviceCell(XSSFRow row, int col, String value, XSSFCellStyle style) {
        XSSFCell cell = row.createCell(col);
        cell.setCellValue(value != null ? value : "");
        cell.setCellStyle(style);
    }

    private MultiportalRow buildRow(
            Vehicle vehicle,
            String blockKey,
            OperationalSnapshot snapshot,
            DeviceLinkage activeLinkage,
            VehicleObservation lastObservation,
            LetterRecord activeLetter,
            Policy policy
    ) {

        String numberStr = activeLinkage != null && activeLinkage.getDevice() != null
                ? activeLinkage.getDevice().getNumberStr()
                : null;

        LocalDateTime lastCommunicationAt = snapshot != null ? snapshot.getLastCommunicationAt() : null;

        StringBuilder status = new StringBuilder();

        if (lastObservation != null && lastObservation.getText() != null) {
            status.append(lastObservation.getText());
        }

        if (activeLetter != null) {
            if (!status.isEmpty()) status.append(" ");
            status.append("#CARTASUSPENSAO");
        }

        if (Boolean.TRUE.equals(vehicle.getInMaintenance())) {
            if (!status.isEmpty()) status.append(" ");
            status.append("#MANUTENCAO");
        }

        String insuredName = policy != null && policy.getInsuredName() != null
                ? policy.getInsuredName()
                : vehicle.getInsuredName();

        return new MultiportalRow(
                vehicle.getPlate(),
                numberStr,
                lastCommunicationAt != null ? lastCommunicationAt.toLocalDate() : null,
                lastCommunicationAt != null ? lastCommunicationAt.toLocalTime() : null,
                status.toString(),
                insuredName,
                policy != null ? policy.getPolicyNumber() : null,
                policy != null ? policy.getEndDate() : null,
                policy != null ? policy.getCpfCnpj() : null,
                blockKey
        );

    }

}
