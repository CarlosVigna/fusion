package com.fusion.fusion.vehicle.multiportal.device;

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
import com.fusion.fusion.vehicle.VehicleRepository;
import com.fusion.fusion.vehicle.multiportal.linkage.DeviceLinkage;
import com.fusion.fusion.vehicle.multiportal.linkage.DeviceLinkageRepository;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;
import java.util.function.Consumer;
import java.util.function.Supplier;

@Service
@RequiredArgsConstructor
public class DeviceImportService {

    private static final String SOURCE_IMPORT = "DEVICE";

    private final DeviceRepository deviceRepository;
    private final VehicleRepository vehicleRepository;
    private final DeviceLinkageRepository linkageRepository;
    private final PendingChangeService pendingChangeService;

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

                // numberStr é o identificador do dispositivo nesta planilha
                // (é o que a planilha de Vínculo usa para casar com o Device).
                // IMEI costuma vir vazio e não pode mais bloquear a criação.
                String numberStr =
                        getCellValue(row.getCell(1));

                if (numberStr == null || numberStr.isBlank()) {
                    continue;
                }

                Optional<Device> optionalDevice =
                        deviceRepository.findByNumberStr(numberStr);

                boolean isNewDevice = optionalDevice.isEmpty();

                Device device;

                if (optionalDevice.isPresent()) {

                    device = optionalDevice.get();

                } else {

                    device = Device.builder()
                            .numberStr(numberStr)
                            .build();

                    imported++;

                }

                String plate =
                        PlateNormalizer.normalize(
                                getCellValue(row.getCell(4))
                        );

                boolean hasValidPlate =
                        plate != null
                                && !plate.isBlank()
                                && PlateValidator.isValidPlate(plate);

                if (!hasValidPlate) {
                    continue;
                }

                String imei =
                        getCellValue(row.getCell(12));

                if (imei != null && !imei.isBlank()) {
                    device.setImei(imei);
                }

                device.setNumber(
                        getCellValue(row.getCell(0))
                );

                // Em dispositivo já existente e vinculado a um veículo,
                // mudanças nesses campos vão para aprovação em vez de
                // serem aplicadas direto. Em dispositivo novo (ou ainda
                // sem veículo conhecido) aplica-se direto — é cadastro,
                // não "mudança".
                boolean requiresApproval =
                        !isNewDevice && hasValidPlate;

                applySensitiveField(
                        device::getOperator,
                        device::setOperator,
                        getCellValue(row.getCell(7)),
                        plate,
                        "operator",
                        requiresApproval
                );

                applySensitiveField(
                        device::getLineNumber,
                        device::setLineNumber,
                        getCellValue(row.getCell(8)),
                        plate,
                        "lineNumber",
                        requiresApproval
                );

                applySensitiveField(
                        device::getManufacturer,
                        device::setManufacturer,
                        getCellValue(row.getCell(14)),
                        plate,
                        "manufacturer",
                        requiresApproval
                );

                applySensitiveField(
                        device::getModel,
                        device::setModel,
                        getCellValue(row.getCell(15)),
                        plate,
                        "model",
                        requiresApproval
                );

                device.setActive(
                        "Ativado".equalsIgnoreCase(
                                getCellValue(row.getCell(18))
                        )
                );

                deviceRepository.save(device);

                if (hasValidPlate) {

                    Optional<Vehicle> optionalVehicle =
                            vehicleRepository.findByPlate(plate);

                    if (optionalVehicle.isPresent()) {

                        Vehicle vehicle = optionalVehicle.get();

                        device.setVehicle(vehicle);

                        deviceRepository.save(device);

                        linked++;

                        if (linkageRepository
                                .findByVehicleAndDeviceAndActiveTrue(
                                        vehicle,
                                        device
                                ).isEmpty()) {

                            DeviceLinkage linkage =
                                    DeviceLinkage.builder()
                                            .vehicle(vehicle)
                                            .device(device)
                                            .manufacturer(
                                                    device.getManufacturer()
                                            )
                                            .active(true)
                                            .build();

                            linkageRepository.save(linkage);

                        }

                    }

                }

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

    private void applySensitiveField(
            Supplier<String> getter,
            Consumer<String> setter,
            String newValue,
            String plate,
            String fieldName,
            boolean requiresApproval
    ) {

        String currentValue = getter.get();

        if (requiresApproval
                && pendingChangeService.detect(
                        plate,
                        fieldName,
                        currentValue,
                        newValue,
                        SOURCE_IMPORT
                )) {

            return; // mudança pendente registrada, mantém o valor atual

        }

        setter.accept(newValue);

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
