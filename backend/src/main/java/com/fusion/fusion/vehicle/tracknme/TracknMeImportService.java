package com.fusion.fusion.vehicle.tracknme;

import com.fusion.fusion.importation.ImportHistoryService;
import com.fusion.fusion.importation.ImportType;
import com.fusion.fusion.importation.storage.enums.ImportFileType;
import com.fusion.fusion.importation.storage.enums.ImportPlatform;
import com.fusion.fusion.importation.storage.service.ImportBackupService;
import com.fusion.fusion.importation.storage.service.ImportFileManagerService;
import com.fusion.fusion.importation.storage.service.ImportFileNamingService;
import com.fusion.fusion.vehicle.Vehicle;
import com.fusion.fusion.vehicle.VehiclePlatform;
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
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class TracknMeImportService {

    private final VehicleRepository repository;

    private final VehicleOperationalStateRepository
            operationalRepository;

    private final ImportHistoryService importHistoryService;

    private final ImportFileManagerService fileManagerService;

    private final ImportBackupService backupService;

    private final ImportFileNamingService namingService;

    private static final DateTimeFormatter FORMATTER =
            DateTimeFormatter.ofPattern(
                    "dd/MM/yyyy HH:mm:ss"
            );

    public TracknMeImportResponse importFile(
            MultipartFile file
    ) {

        int updated = 0;
        int created = 0;

        Path tempFile = null;
        Path processingFile = null;

        try {

            tempFile = Files.createTempFile(
                    "tracknme",
                    ".xlsx"
            );

            file.transferTo(tempFile);

            processingFile =
                    fileManagerService.moveToProcessing(
                            tempFile
                    );

            InputStream inputStream =
                    Files.newInputStream(processingFile);

            Workbook workbook =
                    WorkbookFactory.create(inputStream);

            Sheet sheet = workbook.getSheetAt(0);

            for (int i = 1; i <= sheet.getLastRowNum(); i++) {

                Row row = sheet.getRow(i);

                if (row == null) {
                    continue;
                }

                String plate =
                        getCellValue(row.getCell(8));

                if (plate == null || plate.isBlank()) {
                    continue;
                }

                plate = normalizePlate(plate);

                Optional<Vehicle> optionalVehicle =
                        repository.findByPlate(plate);

                Vehicle vehicle;

                if (optionalVehicle.isPresent()) {

                    vehicle = optionalVehicle.get();

                    updated++;

                } else {

                    vehicle = Vehicle.builder()
                            .plate(plate)
                            .platform(
                                    VehiclePlatform.TRACKNME
                            )
                            .build();

                    created++;

                }

                vehicle.setInsuredName(
                        getCellValue(row.getCell(7))
                );

                repository.save(vehicle);

                Optional<VehicleOperationalState>
                        optionalOperational =
                        operationalRepository.findByVehicle(
                                vehicle
                        );

                VehicleOperationalState operational;

                if (optionalOperational.isPresent()) {

                    operational =
                            optionalOperational.get();

                } else {

                    operational =
                            VehicleOperationalState.builder()
                                    .vehicle(vehicle)
                                    .build();

                }

                boolean online =
                        "Ativo".equalsIgnoreCase(
                                getCellValue(row.getCell(6))
                        );

                operational.setOnline(online);

                operational.setLastCommunicationAt(
                        LocalDateTime.now(ZoneOffset.UTC)
                );

                operational.setUpdatedAt(
                        LocalDateTime.now(ZoneOffset.UTC)
                );

                String lastCommunication =
                        getCellValue(row.getCell(5));

                if (lastCommunication != null
                        && !lastCommunication.isBlank()) {

                    operational.setLastCommunicationAt(
                            LocalDateTime.parse(
                                    lastCommunication,
                                    FORMATTER
                            )
                    );

                }

                operational.setUpdatedAt(
                        LocalDateTime.now(ZoneOffset.UTC)
                );

                operationalRepository.save(operational);

            }

            workbook.close();

            String backupName =
                    namingService.build(
                            ImportFileType.TRACKNME_TRACKERS,
                            ".xlsx"
                    );

            backupService.moveToBackup(
                    processingFile,
                    ImportPlatform.TRACKNME,
                    backupName
            );

            importHistoryService.register(
                    ImportType.TRACKNME,
                    file.getOriginalFilename(),
                    updated + created
            );

        } catch (Exception e) {

            if (processingFile != null) {

                fileManagerService.moveToFailed(
                        processingFile
                );

            }

            throw new RuntimeException(
                    "Erro ao importar TracknMe"
            );

        }

        return new TracknMeImportResponse(
                updated,
                created,
                0,
                List.of()
        );

    }

    private String getCellValue(Cell cell) {

        if (cell == null) {
            return null;
        }

        return switch (cell.getCellType()) {

            case STRING ->
                    cell.getStringCellValue();

            case NUMERIC ->
                    String.valueOf(
                            (long)
                                    cell.getNumericCellValue()
                    );

            default -> null;

        };

    }

    private String normalizePlate(String plate) {

        return plate
                .replace("-", "")
                .replace(" ", "")
                .trim()
                .toUpperCase();

    }

}