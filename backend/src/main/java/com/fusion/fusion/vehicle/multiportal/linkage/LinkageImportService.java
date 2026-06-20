package com.fusion.fusion.vehicle.multiportal.linkage;

import com.fusion.fusion.importation.ImportHistoryService;
import com.fusion.fusion.importation.ImportStatus;
import com.fusion.fusion.importation.ImportType;
import com.fusion.fusion.importation.storage.enums.ImportFileType;
import com.fusion.fusion.importation.storage.enums.ImportPlatform;
import com.fusion.fusion.importation.storage.service.ImportBackupService;
import com.fusion.fusion.importation.storage.service.ImportFileManagerService;
import com.fusion.fusion.importation.storage.service.ImportFileNamingService;
import com.fusion.fusion.pendingchange.PendingChangeService;
import com.fusion.fusion.vehicle.PlateNormalizer;
import com.fusion.fusion.vehicle.PlateValidator;
import com.fusion.fusion.vehicle.Vehicle;
import com.fusion.fusion.vehicle.VehiclePlatform;
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

    private static final String SOURCE_IMPORT = "LINKAGE";

    private final DeviceLinkageRepository repository;
    private final VehicleRepository vehicleRepository;
    private final DeviceRepository deviceRepository;
    private final PendingChangeService pendingChangeService;

    private final ImportFileManagerService fileManagerService;
    private final ImportBackupService backupService;
    private final ImportFileNamingService namingService;
    private final ImportHistoryService importHistoryService;

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
                        PlateNormalizer.normalize(
                                getCellValue(row.getCell(2))
                        );

                if (!PlateValidator.isValidPlate(plate)) {
                    continue;
                }

                String status =
                        getCellValue(row.getCell(7));

                if (!"Aberto".equalsIgnoreCase(status)) {
                    continue; // ignora vínculo encerrado
                }

                Vehicle vehicle =
                        vehicleRepository.findByPlate(plate)
                                .orElseGet(() ->
                                        vehicleRepository.save(
                                                Vehicle.builder()
                                                        .plate(plate)
                                                        .platform(
                                                                VehiclePlatform.MULTIPORTAL
                                                        )
                                                        .build()
                                        )
                                );

                linkedVehicles++;

                String numberStr =
                        getCellValue(row.getCell(5));

                Optional<Device> optionalDevice =
                        deviceRepository.findByNumberStr(numberStr);

                if (optionalDevice.isEmpty()) {
                    continue;
                }

                Device device = optionalDevice.get();

                Optional<DeviceLinkage> currentActiveLinkage =
                        repository.findByVehicleAndActiveTrue(vehicle);

                if (currentActiveLinkage.isPresent()
                        && !currentActiveLinkage.get()
                                .getDevice()
                                .getId()
                                .equals(device.getId())) {

                    // veículo já tem outro dispositivo ativo — troca de
                    // dispositivo precisa de aprovação, não troca direto
                    pendingChangeService.detect(
                            plate,
                            "dispositivo",
                            currentActiveLinkage.get()
                                    .getDevice()
                                    .getNumberStr(),
                            device.getNumberStr(),
                            SOURCE_IMPORT
                    );

                    continue;

                }

                device.setVehicle(vehicle);

                deviceRepository.save(device);

                Optional<DeviceLinkage> existingLinkage =
                        repository.findByVehicleAndDeviceAndActiveTrue(
                                vehicle,
                                device
                        );

                DeviceLinkage linkage =
                        existingLinkage.orElseGet(() ->
                                DeviceLinkage.builder()
                                        .vehicle(vehicle)
                                        .device(device)
                                        .active(true)
                                        .build()
                        );

                // Já pode existir um vínculo criado pelo import de
                // Dispositivos (sem datas) — aqui completamos/atualizamos
                // as datas reais, sem nunca duplicar o registro.
                linkage.setManufacturer(
                        getCellValue(row.getCell(6))
                );

                linkage.setStartAt(
                        parseDate(getCellValue(row.getCell(0)))
                );

                linkage.setEndAt(
                        parseDate(getCellValue(row.getCell(1)))
                );

                repository.save(linkage);

                active++;
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

            importHistoryService.register(
                    ImportType.MULTIPORTAL_LINKAGE,
                    backupName,
                    imported
            );

        } catch (Exception e) {

            if (processingFile != null) {
                fileManagerService.moveToFailed(processingFile);
            }

            importHistoryService.register(
                    ImportType.MULTIPORTAL_LINKAGE,
                    file.getOriginalFilename(),
                    0,
                    ImportStatus.FAILED
            );

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


}