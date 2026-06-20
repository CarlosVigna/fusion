package com.fusion.fusion.vehicle.multiportal.operational;

import com.fusion.fusion.importation.ImportHistoryService;
import com.fusion.fusion.importation.ImportStatus;
import com.fusion.fusion.importation.ImportType;
import com.fusion.fusion.importation.storage.enums.ImportFileType;
import com.fusion.fusion.importation.storage.enums.ImportPlatform;
import com.fusion.fusion.importation.storage.service.ImportBackupService;
import com.fusion.fusion.importation.storage.service.ImportFileManagerService;
import com.fusion.fusion.importation.storage.service.ImportFileNamingService;
import com.fusion.fusion.vehicle.PlateNormalizer;
import com.fusion.fusion.vehicle.PlateValidator;
import com.fusion.fusion.vehicle.Vehicle;
import com.fusion.fusion.vehicle.VehicleRepository;
import com.fusion.fusion.vehicle.operational.CommunicationStatus;
import com.fusion.fusion.vehicle.operational.VehicleOperationalState;
import com.fusion.fusion.vehicle.operational.VehicleOperationalStateRepository;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class OperationalListImportService {

    private static final DateTimeFormatter DATE_FORMATTER =
            DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");

    private final VehicleRepository vehicleRepository;
    private final VehicleOperationalStateRepository operationalRepository;

    private final ImportFileManagerService fileManagerService;
    private final ImportBackupService backupService;
    private final ImportFileNamingService namingService;
    private final ImportHistoryService importHistoryService;

    public OperationalListImportResponse importFile(
            MultipartFile file
    ) {

        int updated = 0;

        List<String> notFound = new ArrayList<>();

        Path tempFile = null;
        Path processingFile = null;

        try {

            tempFile = Files.createTempFile(
                    "multiportal-ultima-posicao",
                    ".xls"
            );

            file.transferTo(tempFile);

            processingFile =
                    fileManagerService.moveToProcessing(tempFile);

            InputStream inputStream =
                    Files.newInputStream(processingFile);

            Workbook workbook =
                    WorkbookFactory.create(inputStream);

            Sheet sheet = workbook.getSheetAt(0);

            int headerRow = findHeaderRow(sheet);

            for (int i = headerRow + 1; i <= sheet.getLastRowNum(); i++) {

                Row row = sheet.getRow(i);

                if (row == null) {
                    continue;
                }

                String plate =
                        PlateNormalizer.normalize(
                                getCellValue(row.getCell(0))
                        );

                if (!PlateValidator.isValidPlate(plate)) {
                    continue;
                }

                Optional<Vehicle> optionalVehicle =
                        vehicleRepository.findByPlate(plate);

                if (optionalVehicle.isEmpty()) {

                    notFound.add(plate);

                    continue;

                }

                Vehicle vehicle = optionalVehicle.get();

                String insuredName =
                        getCellValue(row.getCell(11));

                if (insuredName != null
                        && !insuredName.isBlank()
                        && !insuredName.equals(vehicle.getInsuredName())) {

                    vehicle.setInsuredName(insuredName);

                    vehicleRepository.save(vehicle);

                }

                VehicleOperationalState state =
                        operationalRepository.findByVehicle(vehicle)
                                .orElse(
                                        VehicleOperationalState.builder()
                                                .vehicle(vehicle)
                                                .build()
                                );

                boolean online =
                        "Sim".equalsIgnoreCase(
                                getCellValue(row.getCell(8))
                        );

                state.setOnline(online);

                state.setCommunicationStatus(
                        online
                                ? CommunicationStatus.ONLINE
                                : CommunicationStatus.OFFLINE
                );

                state.setSpeed(
                        parseDouble(getCellValue(row.getCell(7)))
                );

                state.setAddress(
                        getCellValue(row.getCell(12))
                );

                state.setBatteryLevel(
                        parseBattery(getCellValue(row.getCell(14)))
                );

                LocalDateTime lastCommunicationAt =
                        parseDate(getCellValue(row.getCell(3)));

                LocalDateTime lastPositionAt =
                        parseDate(getCellValue(row.getCell(4)));

                if (lastCommunicationAt != null) {
                    state.setLastCommunicationAt(lastCommunicationAt);
                }

                if (lastPositionAt != null) {
                    state.setLastPositionAt(lastPositionAt);
                }

                state.setUpdatedAt(LocalDateTime.now());

                operationalRepository.save(state);

                updated++;

            }

            workbook.close();

            String backupName =
                    namingService.build(
                            ImportFileType.MULTIPORTAL_LIST,
                            ".xls"
                    );

            backupService.moveToBackup(
                    processingFile,
                    ImportPlatform.MULTIPORTAL,
                    backupName
            );

            importHistoryService.register(
                    ImportType.MULTIPORTAL_OPERATIONAL,
                    backupName,
                    updated
            );

        } catch (Exception e) {

            if (processingFile != null) {
                fileManagerService.moveToFailed(processingFile);
            }

            importHistoryService.register(
                    ImportType.MULTIPORTAL_OPERATIONAL,
                    file.getOriginalFilename(),
                    0,
                    ImportStatus.FAILED
            );

            throw new RuntimeException(
                    "Erro ao importar última posição: " + e.getMessage(),
                    e
            );

        }

        return new OperationalListImportResponse(
                updated,
                notFound.size(),
                notFound
        );

    }

    private int findHeaderRow(Sheet sheet) {

        for (int i = 0; i <= sheet.getLastRowNum(); i++) {

            Row row = sheet.getRow(i);

            if (row == null) {
                continue;
            }

            String firstCell = getCellValue(row.getCell(0));

            if ("Placa".equalsIgnoreCase(
                    firstCell == null ? null : firstCell.trim()
            )) {
                return i;
            }

        }

        throw new RuntimeException(
                "Linha de cabeçalho (\"Placa\") não encontrada na planilha."
        );

    }

    private Double parseDouble(String value) {

        if (value == null || value.isBlank()) {
            return null;
        }

        try {
            return Double.parseDouble(
                    value.replace(",", ".").trim()
            );
        } catch (NumberFormatException e) {
            return null;
        }

    }

    private Integer parseBattery(String value) {

        if (value == null || value.isBlank()) {
            return null;
        }

        try {
            return Integer.parseInt(
                    value.replace("%", "").trim()
            );
        } catch (NumberFormatException e) {
            return null;
        }

    }

    private LocalDateTime parseDate(String value) {

        if (value == null || value.isBlank()) {
            return null;
        }

        try {
            return LocalDateTime.parse(
                    value.trim(),
                    DATE_FORMATTER
            );
        } catch (Exception e) {
            return null;
        }

    }

    private String getCellValue(Cell cell) {

        if (cell == null) {
            return null;
        }

        return switch (cell.getCellType()) {

            case STRING -> cell.getStringCellValue();

            case NUMERIC ->
                    String.valueOf(
                            (long) cell.getNumericCellValue()
                    );

            default -> null;

        };

    }

}
