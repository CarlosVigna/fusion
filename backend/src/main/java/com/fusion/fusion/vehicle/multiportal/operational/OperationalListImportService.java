package com.fusion.fusion.vehicle.multiportal.operational;

import com.fusion.fusion.importation.ImportHistoryService;
import com.fusion.fusion.importation.ImportStatus;
import com.fusion.fusion.importation.ImportType;
import com.fusion.fusion.importation.storage.enums.ImportFileType;
import com.fusion.fusion.importation.storage.enums.ImportPlatform;
import com.fusion.fusion.importation.storage.service.ImportBackupService;
import com.fusion.fusion.importation.storage.service.ImportFileManagerService;
import com.fusion.fusion.importation.storage.service.ImportFileNamingService;
import com.fusion.fusion.realtime.DashboardRealtimeService;
import com.fusion.fusion.vehicle.PlateNormalizer;
import com.fusion.fusion.vehicle.PlateValidator;
import com.fusion.fusion.vehicle.Vehicle;
import com.fusion.fusion.vehicle.VehicleRepository;
import com.fusion.fusion.vehicle.operational.CommunicationStatus;
import com.fusion.fusion.vehicle.operational.VehicleOperationalState;
import com.fusion.fusion.vehicle.operational.VehicleOperationalStateRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class OperationalListImportService {

    private static final DateTimeFormatter DATE_FORMATTER =
            DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");

    // "Data GSM"/"Data Posicao" da planilha do Multiportal vem em horario
    // de Brasilia, sem indicador de fuso — precisa converter para UTC
    // antes de salvar, ja que o resto do sistema (motor operacional,
    // frontend) trata todo LocalDateTime como UTC.
    private static final ZoneId MULTIPORTAL_ZONE =
            ZoneId.of("America/Sao_Paulo");

    private final VehicleRepository vehicleRepository;
    private final VehicleOperationalStateRepository operationalRepository;

    private final ImportFileManagerService fileManagerService;
    private final ImportBackupService backupService;
    private final ImportFileNamingService namingService;
    private final ImportHistoryService importHistoryService;
    private final DashboardRealtimeService realtimeService;

    @Transactional
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

            // Carrega tudo de uma vez em memória em vez de uma query por
            // linha (era o N+1 que fazia o import de ~260 linhas levar
            // ~4 minutos e travar a thread única do scheduler).
            Map<String, Vehicle> vehiclesByPlate = new HashMap<>();

            for (Vehicle vehicle : vehicleRepository.findAll()) {
                vehiclesByPlate.put(vehicle.getPlate(), vehicle);
            }

            Map<UUID, VehicleOperationalState> statesByVehicleId =
                    new HashMap<>();

            for (VehicleOperationalState state :
                    operationalRepository.findAll()) {

                if (state.getVehicle() != null) {
                    statesByVehicleId.put(
                            state.getVehicle().getId(),
                            state
                    );
                }

            }

            List<Vehicle> vehiclesToSave = new ArrayList<>();
            List<VehicleOperationalState> statesToSave = new ArrayList<>();

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

                Vehicle vehicle = vehiclesByPlate.get(plate);

                if (vehicle == null) {

                    notFound.add(plate);

                    continue;

                }

                String insuredName =
                        getCellValue(row.getCell(11));

                boolean vehicleChanged = false;

                if (insuredName != null
                        && !insuredName.isBlank()
                        && !insuredName.equals(vehicle.getInsuredName())) {

                    vehicle.setInsuredName(insuredName);

                    vehicleChanged = true;

                }

                VehicleOperationalState state =
                        statesByVehicleId.get(vehicle.getId());

                if (state == null) {

                    state = VehicleOperationalState.builder()
                            .vehicle(vehicle)
                            .build();

                    statesByVehicleId.put(vehicle.getId(), state);

                }

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

                    if (!Boolean.TRUE.equals(
                            vehicle.getHasEverCommunicated()
                    )) {

                        vehicle.setHasEverCommunicated(true);

                        vehicleChanged = true;

                    }

                }

                if (vehicleChanged) {
                    vehiclesToSave.add(vehicle);
                }

                state.setUpdatedAt(LocalDateTime.now(ZoneOffset.UTC));

                statesToSave.add(state);

                updated++;

            }

            workbook.close();

            if (!vehiclesToSave.isEmpty()) {
                vehicleRepository.saveAll(vehiclesToSave);
            }

            if (!statesToSave.isEmpty()) {
                operationalRepository.saveAll(statesToSave);
            }

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

            // Avisa o frontend (via WS) que ha posicoes novas — o Grid
            // escuta isso pra se atualizar sozinho, sem precisar de F5.
            realtimeService.publish(
                    "GRID_UPDATED",
                    "Última posição atualizada (" + updated + " veículos)"
            );

        } catch (Exception e) {

            // Loga o erro REAL primeiro — antes, se moveToFailed() ou o
            // register() abaixo lançassem (ex.: o arquivo já tinha sido
            // movido para backup/ por moveToBackup() mais acima, ou uma
            // falha de conexão), a exceção original era perdida e
            // substituída por um NoSuchFileException sem nenhuma pista
            // do problema de verdade.
            log.error(
                    "Erro ao importar última posição",
                    e
            );

            try {

                importHistoryService.register(
                        ImportType.MULTIPORTAL_OPERATIONAL,
                        file.getOriginalFilename(),
                        0,
                        ImportStatus.FAILED
                );

            } catch (Exception registerError) {

                log.error(
                        "Erro adicional ao registrar falha do import em import_history",
                        registerError
                );

            }

            if (processingFile != null
                    && Files.exists(processingFile)) {

                fileManagerService.moveToFailed(processingFile);

            }

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

            LocalDateTime brasiliaLocal = LocalDateTime.parse(
                    value.trim(),
                    DATE_FORMATTER
            );

            return brasiliaLocal
                    .atZone(MULTIPORTAL_ZONE)
                    .withZoneSameInstant(ZoneOffset.UTC)
                    .toLocalDateTime();

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
