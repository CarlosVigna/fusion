package com.fusion.fusion.vehicle.multiportal.linkage;

import com.fusion.fusion.importation.storage.enums.ImportFileType;
import com.fusion.fusion.importation.storage.enums.ImportPlatform;
import com.fusion.fusion.importation.storage.service.ImportBackupService;
import com.fusion.fusion.importation.storage.service.ImportFileManagerService;
import com.fusion.fusion.importation.storage.service.ImportFileNamingService;
import com.fusion.fusion.vehicle.Vehicle;
import com.fusion.fusion.vehicle.VehicleRepository;
import com.fusion.fusion.vehicle.multiportal.device.Device;
import com.fusion.fusion.vehicle.multiportal.device.DeviceRepository;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class LinkageImportService {

    private final DeviceLinkageRepository repository;
    private final VehicleRepository vehicleRepository;
    private final DeviceRepository deviceRepository;

    private final ImportFileManagerService fileManagerService;
    private final ImportBackupService backupService;
    private final ImportFileNamingService namingService;

    private static final DateTimeFormatter FORMATTER =
            DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");

    public LinkageImportResponse importFile(
            MultipartFile file
    ) {

        int imported = 0;
        int active = 0;
        int linkedVehicles = 0;

        Path tempFile = null;
        Path processingFile = null;

        try {

            tempFile = Files.createTempFile(
                    "multiportal-linkage",
                    ".xlsx"
            );

            file.transferTo(tempFile);

            processingFile =
                    fileManagerService.moveToProcessing(tempFile);

            InputStream inputStream =
                    Files.newInputStream(processingFile);

            Workbook workbook =
                    WorkbookFactory.create(inputStream);

            Sheet sheet = workbook.getSheetAt(0);

            int headerRow = findHeaderRow(sheet, "Data Inicial");

            for (int i = headerRow + 1; i <= sheet.getLastRowNum(); i++) {

                Row row = sheet.getRow(i);

                if (row == null) {
                    continue;
                }

                String plate =
                        normalizePlate(
                                getCellValue(row.getCell(2))
                        );

                if (plate == null || plate.isBlank()) {
                    continue;
                }

                Optional<Vehicle> optionalVehicle =
                        vehicleRepository.findByPlate(plate);

                if (optionalVehicle.isEmpty()) {
                    continue;
                }

                Vehicle vehicle = optionalVehicle.get();

                linkedVehicles++;

                String numberStr =
                        getCellValue(row.getCell(5));

                Optional<Device> optionalDevice =
                        deviceRepository.findAll()
                                .stream()
                                .filter(device ->
                                        numberStr.equals(
                                                device.getNumberStr()
                                        )
                                )
                                .findFirst();

                if (optionalDevice.isEmpty()) {
                    continue;
                }

                Device device = optionalDevice.get();

                String status =
                        getCellValue(row.getCell(7));

                boolean isActive =
                        "Aberto".equalsIgnoreCase(status);

                if (isActive) {
                    active++;
                }

                DeviceLinkage linkage =
                        DeviceLinkage.builder()
                                .vehicle(vehicle)
                                .device(device)
                                .manufacturer(
                                        getCellValue(
                                                row.getCell(6)
                                        )
                                )
                                .active(isActive)
                                .startAt(
                                        parseDate(
                                                getCellValue(
                                                        row.getCell(0)
                                                )
                                        )
                                )
                                .endAt(
                                        parseDate(
                                                getCellValue(
                                                        row.getCell(1)
                                                )
                                        )
                                )
                                .build();

                repository.save(linkage);

                imported++;

            }

            workbook.close();

            String backupName =
                    namingService.build(
                            ImportFileType.MULTIPORTAL_LINKS,
                            ".xlsx"
                    );

            backupService.moveToBackup(
                    processingFile,
                    ImportPlatform.MULTIPORTAL,
                    backupName
            );

        } catch (Exception e) {

            if (processingFile != null) {
                fileManagerService.moveToFailed(processingFile);
            }

            throw new RuntimeException(
                    "Erro ao importar vínculos"
            );

        }

        return new LinkageImportResponse(
                imported,
                active,
                linkedVehicles
        );

    }

    private LocalDateTime parseDate(String value) {

        if (value == null || value.isBlank()) {
            return null;
        }

        return LocalDateTime.parse(
                value,
                FORMATTER
        );

    }

    private int findHeaderRow(Sheet sheet, String expectedFirstColumn) {

        for (int i = 0; i <= sheet.getLastRowNum(); i++) {

            Row row = sheet.getRow(i);

            if (row == null) {
                continue;
            }

            String firstCell = getCellValue(row.getCell(0));

            if (expectedFirstColumn.equalsIgnoreCase(
                    firstCell == null ? null : firstCell.trim()
            )) {
                return i;
            }

        }

        throw new RuntimeException(
                "Linha de cabeçalho (\"" + expectedFirstColumn
                        + "\") não encontrada na planilha."
        );

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

    private String normalizePlate(String plate) {

        if (plate == null) {
            return null;
        }

        return plate
                .replace("-", "")
                .replace(" ", "")
                .trim()
                .toUpperCase();

    }

}