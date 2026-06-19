package com.fusion.fusion.vehicle.multiportal.device;

import com.fusion.fusion.importation.ImportHistoryService;
import com.fusion.fusion.importation.ImportStatus;
import com.fusion.fusion.importation.ImportType;
import com.fusion.fusion.importation.storage.enums.ImportFileType;
import com.fusion.fusion.importation.storage.enums.ImportPlatform;
import com.fusion.fusion.importation.storage.service.ImportBackupService;
import com.fusion.fusion.importation.storage.service.ImportFileManagerService;
import com.fusion.fusion.importation.storage.service.ImportFileNamingService;
import com.fusion.fusion.vehicle.Vehicle;
import com.fusion.fusion.vehicle.VehicleRepository;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class DeviceImportService {

    private final DeviceRepository deviceRepository;
    private final VehicleRepository vehicleRepository;

    private final ImportFileManagerService fileManagerService;
    private final ImportBackupService backupService;
    private final ImportFileNamingService namingService;
    private final ImportHistoryService importHistoryService;

    public DeviceImportResponse importFile(
            MultipartFile file
    ) {

        int imported = 0;
        int linked = 0;

        Path tempFile = null;
        Path processingFile = null;

        try {

            tempFile = Files.createTempFile(
                    "multiportal-devices",
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

            int headerRow = findHeaderRow(sheet, "Número");

            for (int i = headerRow + 1; i <= sheet.getLastRowNum(); i++) {

                Row row = sheet.getRow(i);

                if (row == null) {
                    continue;
                }

                String imei =
                        getCellValue(row.getCell(12));

                if (imei == null || imei.isBlank()) {
                    continue;
                }

                Optional<Device> optionalDevice =
                        deviceRepository.findByImei(imei);

                Device device;

                if (optionalDevice.isPresent()) {

                    device = optionalDevice.get();

                } else {

                    device = Device.builder()
                            .imei(imei)
                            .build();

                    imported++;

                }

                String plate =
                        normalizePlate(
                                getCellValue(row.getCell(4))
                        );

                Optional<Vehicle> optionalVehicle =
                        vehicleRepository.findByPlate(plate);

                optionalVehicle.ifPresent(device::setVehicle);

                if (optionalVehicle.isPresent()) {
                    linked++;
                }

                device.setNumber(
                        getCellValue(row.getCell(0))
                );

                device.setNumberStr(
                        getCellValue(row.getCell(1))
                );

                device.setOperator(
                        getCellValue(row.getCell(7))
                );

                device.setLineNumber(
                        getCellValue(row.getCell(8))
                );

                device.setManufacturer(
                        getCellValue(row.getCell(14))
                );

                device.setModel(
                        getCellValue(row.getCell(15))
                );

                device.setActive(
                        "Ativado".equalsIgnoreCase(
                                getCellValue(row.getCell(18))
                        )
                );

                deviceRepository.save(device);

            }

            workbook.close();

            String backupName =
                    namingService.build(
                            ImportFileType.MULTIPORTAL_DEVICES,
                            ".xlsx"
                    );

            backupService.moveToBackup(
                    processingFile,
                    ImportPlatform.MULTIPORTAL,
                    backupName
            );

            importHistoryService.register(
                    ImportType.MULTIPORTAL_DEVICE,
                    backupName,
                    imported
            );

        } catch (Exception e) {

            if (processingFile != null) {
                fileManagerService.moveToFailed(processingFile);
            }

            importHistoryService.register(
                    ImportType.MULTIPORTAL_DEVICE,
                    file.getOriginalFilename(),
                    0,
                    ImportStatus.FAILED
            );

            throw new RuntimeException(
                    "Erro ao importar dispositivos"
            );

        }

        return new DeviceImportResponse(
                imported,
                linked
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