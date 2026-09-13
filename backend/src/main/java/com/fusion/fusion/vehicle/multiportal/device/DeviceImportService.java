package com.fusion.fusion.vehicle.multiportal.device;

import com.fusion.fusion.importation.ImportDiffLog;
import com.fusion.fusion.importation.ImportDiffLogRepository;
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
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Consumer;
import java.util.function.Supplier;
import java.util.stream.Collectors;

@Slf4j
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
    private final ImportDiffLogRepository diffLogRepository;

    // Tudo carregado em memoria antes do loop (3 queries) em vez de
    // findByNumberStr/findByPlate/findByVehicleAndDeviceAndActiveTrue por
    // linha da planilha — o gargalo real contra o Neon nao era o commit
    // em si, era a quantidade de round-trips (ida-e-volta de rede) por
    // linha. Import inteiro cabe numa unica transacao porque nao ha mais
    // nenhuma query "presa" no meio do loop.
    @Transactional
    public DeviceImportResponse importFile(
            MultipartFile file
    ) {

        int imported = 0;
        int linked = 0;
        int changed = 0;
        int updated = 0;
        int unchanged = 0;

        List<Map<String, String>> addedDetails   = new ArrayList<>();
        List<Map<String, Object>> changedDetails  = new ArrayList<>();

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
            int serialChip1Col = findColumnIndex(sheet, headerRow, "Serial Chip 1");

            Map<String, Device> existingByNumberStr = deviceRepository.findAllWithVehicle().stream()
                    .filter(d -> d.getNumberStr() != null)
                    .collect(Collectors.toMap(Device::getNumberStr, d -> d, (a, b) -> a));

            Map<String, Vehicle> vehiclesByPlate = vehicleRepository.findAll().stream()
                    .filter(v -> v.getPlate() != null)
                    .collect(Collectors.toMap(Vehicle::getPlate, v -> v, (a, b) -> a));

            // Chave placa+numberStr em vez de vehicleId+deviceId: um
            // Device novo criado nesta execucao ainda nao tem UUID (so' e'
            // atribuido no saveAll no final), entao chavear por id
            // colidiria com "null" entre varios devices novos diferentes
            // na mesma planilha. String sempre disponivel evita isso.
            Set<String> activeLinkagePairs = linkageRepository.findAllActiveWithVehicleAndDevice().stream()
                    .filter(l -> l.getVehicle() != null && l.getDevice() != null
                            && l.getVehicle().getPlate() != null && l.getDevice().getNumberStr() != null)
                    .map(l -> l.getVehicle().getPlate() + "|" + l.getDevice().getNumberStr())
                    .collect(Collectors.toCollection(HashSet::new));

            List<Device> devicesToSave = new ArrayList<>();
            List<DeviceLinkage> linkagesToSave = new ArrayList<>();

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

                Device existing = existingByNumberStr.get(numberStr);

                boolean isNewDevice = existing == null;

                Device device;

                if (!isNewDevice) {

                    device = existing;

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
                    // Device novo sem placa valida e' descartado sem ser
                    // salvo — mesmo comportamento de antes (o save() so'
                    // acontecia depois deste ponto).
                    continue;
                }

                // Snapshot ANTES de qualquer device.set*() desta linha —
                // usado no gate de "mudou de verdade" mais abaixo, pra o
                // saveAll() nao regravar todo device processado, so' os
                // que tiveram algum campo realmente alterado.
                Boolean prevActive       = device.getActive();
                String prevOperator      = device.getOperator();
                String prevLineNumber    = device.getLineNumber();
                String prevImei          = device.getImei();
                String prevModel         = device.getModel();
                String prevManufacturer  = device.getManufacturer();
                String prevVehiclePlate  = device.getVehicle() != null ? device.getVehicle().getPlate() : null;

                String imei =
                        getCellValue(row.getCell(12));

                if (imei != null && !imei.isBlank()) {
                    device.setImei(imei);
                }

                if (serialChip1Col >= 0) {
                    String serialChip1 = getCellValue(row.getCell(serialChip1Col));
                    if (serialChip1 != null && !serialChip1.isBlank()) {
                        device.setSerialChip1(serialChip1);
                    }
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

                if (!isNewDevice) {
                    String changedField = null;
                    String fromVal = "";
                    String toVal   = "";
                    if (!Objects.equals(device.getOperator(), prevOperator)) {
                        changedField = "operador";
                        fromVal = prevOperator != null ? prevOperator : "";
                        toVal   = device.getOperator() != null ? device.getOperator() : "";
                    } else if (!Objects.equals(device.getLineNumber(), prevLineNumber)) {
                        changedField = "linha";
                        fromVal = prevLineNumber != null ? prevLineNumber : "";
                        toVal   = device.getLineNumber() != null ? device.getLineNumber() : "";
                    } else if (!Objects.equals(device.getManufacturer(), prevManufacturer)) {
                        changedField = "fabricante";
                        fromVal = prevManufacturer != null ? prevManufacturer : "";
                        toVal   = device.getManufacturer() != null ? device.getManufacturer() : "";
                    } else if (!Objects.equals(device.getModel(), prevModel)) {
                        changedField = "modelo";
                        fromVal = prevModel != null ? prevModel : "";
                        toVal   = device.getModel() != null ? device.getModel() : "";
                    }
                    if (changedField != null) {
                        changed++;
                        Map<String, Object> d = new HashMap<>();
                        d.put("plate", plate);
                        d.put("field", changedField);
                        d.put("from",  fromVal);
                        d.put("to",    toVal);
                        changedDetails.add(d);
                    }
                }

                device.setActive(
                        "Ativado".equalsIgnoreCase(
                                getCellValue(row.getCell(18))
                        )
                );

                if (isNewDevice) {
                    // Visivel pra uma segunda linha com o mesmo numberStr
                    // na mesma planilha (equivalente ao auto-flush que o
                    // findByNumberStr via JPA teria disparado antes).
                    existingByNumberStr.put(numberStr, device);
                }

                Vehicle vehicle = vehiclesByPlate.get(plate);

                if (vehicle != null) {

                    device.setVehicle(vehicle);

                    linked++;

                    if (isNewDevice) {
                        Map<String, String> d = new HashMap<>();
                        d.put("plate", plate);
                        d.put("name", vehicle.getInsuredName() != null ? vehicle.getInsuredName() : "");
                        addedDetails.add(d);
                    }

                    String pairKey = plate + "|" + numberStr;

                    if (!activeLinkagePairs.contains(pairKey)) {

                        DeviceLinkage linkage =
                                DeviceLinkage.builder()
                                        .vehicle(vehicle)
                                        .device(device)
                                        .manufacturer(
                                                device.getManufacturer()
                                        )
                                        .active(true)
                                        .build();

                        linkagesToSave.add(linkage);
                        activeLinkagePairs.add(pairKey);

                    }

                }

                String newVehiclePlate = device.getVehicle() != null ? device.getVehicle().getPlate() : null;

                // So' regrava o device se algo realmente mudou. Comparar
                // vehicle por placa (nao por Objects.equals(Vehicle,
                // Vehicle) direto) porque Vehicle nao sobrescreve equals()
                // — duas referencias carregando o MESMO registro do banco
                // (uma vinda do device.getVehicle() eager, outra do mapa
                // vehiclesByPlate) sao objetos Java diferentes e
                // Objects.equals() bateria sempre false por identidade,
                // fazendo TODO device vinculado parecer "mudado".
                boolean deviceChanged = isNewDevice
                        || !Objects.equals(device.getActive(), prevActive)
                        || !Objects.equals(device.getOperator(), prevOperator)
                        || !Objects.equals(device.getLineNumber(), prevLineNumber)
                        || !Objects.equals(device.getImei(), prevImei)
                        || !Objects.equals(device.getModel(), prevModel)
                        || !Objects.equals(device.getManufacturer(), prevManufacturer)
                        || !Objects.equals(newVehiclePlate, prevVehiclePlate);

                if (deviceChanged) {
                    devicesToSave.add(device);
                    if (!isNewDevice) {
                        updated++;
                    }
                } else {
                    unchanged++;
                }

            }

            workbook.close();

            if (!devicesToSave.isEmpty()) {
                deviceRepository.saveAll(devicesToSave);
            }

            if (!linkagesToSave.isEmpty()) {
                linkageRepository.saveAll(linkagesToSave);
            }

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

            Map<String, Object> diffDetails = new HashMap<>();
            diffDetails.put("added",   addedDetails);
            diffDetails.put("removed", new ArrayList<>());
            diffDetails.put("changed", changedDetails);
            String detailsJson;
            try {
                detailsJson = new ObjectMapper().writeValueAsString(diffDetails);
            } catch (Exception ex) {
                detailsJson = "{\"added\":[],\"removed\":[],\"changed\":[]}";
            }

            // Sem mudanca real (nada adicionado/removido/alterado), o
            // registro ainda entra pro historico mas ja sai "dismissed"
            // — sem isso, todo import sem novidade nenhuma tocava o
            // sino do mesmo jeito que um com mudanca de verdade.
            boolean hasRealChange = imported > 0 || changed > 0;

            LocalDateTime diffCreatedAt = LocalDateTime.now(ZoneOffset.UTC);

            diffLogRepository.save(ImportDiffLog.builder()
                    .importType(ImportType.MULTIPORTAL_DEVICE)
                    .added(imported)
                    .removed(0)
                    .changed(changed)
                    .detailsJson(detailsJson)
                    .dismissed(!hasRealChange)
                    .dismissedAt(hasRealChange ? null : diffCreatedAt)
                    .createdAt(diffCreatedAt)
                    .build());

            log.info(
                    "[DEVICE-IMPORT] imported={} updated={} unchanged={} linked={} changed={} devicesToSave={} linkagesToSave={}",
                    imported, updated, unchanged, linked, changed, devicesToSave.size(), linkagesToSave.size()
            );

        } catch (Exception e) {

            if (processingFile != null) {
                fileManagerService.moveToFailed(processingFile);
            }

            // Sem self/REQUIRES_NEW (removido a pedido) — esse registro
            // agora esta' na MESMA transacao de importFile() e e'
            // revertido junto se o metodo relancar a excecao. Import
            // quebrado no meio nao deixa mais rastro de FAILED no
            // historico/diff-log. Ver relatorio.
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
                linked,
                updated,
                unchanged
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

    private int findColumnIndex(Sheet sheet, int headerRowIndex, String columnHeader) {
        Row row = sheet.getRow(headerRowIndex);
        if (row == null) return -1;
        for (int i = 0; i <= row.getLastCellNum(); i++) {
            String val = getCellValue(row.getCell(i));
            if (columnHeader.equalsIgnoreCase(val == null ? null : val.trim())) {
                return i;
            }
        }
        return -1;
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
