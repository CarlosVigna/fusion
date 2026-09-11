package com.fusion.fusion.vehicle.multiportal.linkage;

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
import com.fusion.fusion.vehicle.VehicleGroup;
import com.fusion.fusion.vehicle.VehiclePlatform;
import com.fusion.fusion.vehicle.VehicleRepository;
import com.fusion.fusion.vehicle.multiportal.device.Device;
import com.fusion.fusion.vehicle.multiportal.device.DeviceRepository;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

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
    private final ImportDiffLogRepository diffLogRepository;

    private static final DateTimeFormatter FORMATTER =
            DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");

    // Tudo carregado em memoria antes do loop (3 queries) em vez de
    // findByPlate/findByNumberStr/findByVehicleAndActiveTrue/
    // findByVehicleAndDeviceAndActiveTrue por linha da planilha — o
    // gargalo real contra o Neon nao era o commit em si, era a
    // quantidade de round-trips por linha. Import inteiro cabe numa
    // unica transacao porque nao ha mais nenhuma query "presa" no meio
    // do loop.
    @Transactional
    public LinkageImportResponse importFile(
            MultipartFile file
    ) {

        int imported = 0;
        int active = 0;
        int linkedVehicles = 0;
        int vehiclesAdded = 0;
        int vehiclesRemoved = 0;
        int linksChanged = 0;

        List<Map<String, String>> addedDetails   = new ArrayList<>();
        List<Map<String, String>> removedDetails  = new ArrayList<>();
        List<Map<String, Object>> changedDetails  = new ArrayList<>();

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

            Map<String, Vehicle> vehiclesByPlate = vehicleRepository.findAll().stream()
                    .filter(v -> v.getPlate() != null)
                    .collect(Collectors.toMap(Vehicle::getPlate, v -> v, (a, b) -> a));

            Map<String, Device> devicesByNumberStr = deviceRepository.findAllWithVehicle().stream()
                    .filter(d -> d.getNumberStr() != null)
                    .collect(Collectors.toMap(Device::getNumberStr, d -> d, (a, b) -> a));

            // Chaveado por placa, nao por vehicle.getId(): um Vehicle novo
            // criado nesta execucao ainda nao tem UUID (so' e' atribuido
            // no saveAll no final), entao chavear por id colidiria com
            // "null" entre varios veiculos novos diferentes na mesma
            // planilha. Placa e' sempre disponivel e e' a chave natural
            // de qualquer forma (um veiculo tem no maximo um linkage
            // ativo por vez, mesma premissa ja usada em outros pontos do
            // sistema).
            Map<String, DeviceLinkage> activeLinkageByPlate = repository.findAllActiveWithVehicleAndDevice().stream()
                    .filter(l -> l.getVehicle() != null && l.getVehicle().getPlate() != null)
                    .collect(Collectors.toMap(l -> l.getVehicle().getPlate(), l -> l, (a, b) -> a));

            List<Vehicle> vehiclesToSave       = new ArrayList<>();
            List<Device> devicesToSave         = new ArrayList<>();
            List<DeviceLinkage> linkagesToSave = new ArrayList<>();

            // PASSO 1 — coletar todas as placas com pelo menos um vínculo "Aberto"
            // na planilha, para não soft-deletar veículos que aparecem como
            // encerrados em uma linha mas ativos em outra.
            Set<String> placasComVinculoAberto = new HashSet<>();
            for (int i = headerRow + 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null) continue;
                String plate = PlateNormalizer.normalize(getCellValue(row.getCell(2)));
                if (!PlateValidator.isValidPlate(plate)) continue;
                if ("Aberto".equalsIgnoreCase(getCellValue(row.getCell(7)))) {
                    placasComVinculoAberto.add(plate);
                }
            }

            // PASSO 2 — processar cada linha
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
                    // Só desativar/soft-deletar se a placa não tem nenhum
                    // vínculo "Aberto" em outra linha da mesma planilha.
                    if (!placasComVinculoAberto.contains(plate)) {
                        Vehicle vOpt = vehiclesByPlate.get(plate);
                        if (vOpt != null
                                && deactivateVehicleIfOrphaned(
                                        vOpt, activeLinkageByPlate, linkagesToSave, vehiclesToSave
                                )) {
                            vehiclesRemoved++;
                            Map<String, String> d = new HashMap<>();
                            d.put("plate", plate);
                            d.put("name", vOpt.getInsuredName() != null ? vOpt.getInsuredName() : "");
                            removedDetails.add(d);
                        }
                    }
                    continue;
                }

                boolean vehicleExisted = vehiclesByPlate.containsKey(plate);

                Vehicle vehicle = vehiclesByPlate.get(plate);

                if (vehicle == null) {

                    vehicle = Vehicle.builder()
                            .plate(plate)
                            .platform(
                                    VehiclePlatform.MULTIPORTAL
                            )
                            // Placa fora do padrao oficial (ex:
                            // "CAMPFRANCK", "JEFFLONDRINA") nao e'
                            // frota real — vai pra TEST em vez de
                            // OPERATIONAL (default do Vehicle).
                            .vehicleGroup(
                                    PlateValidator.isStandardFormat(plate)
                                            ? VehicleGroup.OPERATIONAL
                                            : VehicleGroup.TEST
                            )
                            .build();

                    vehiclesByPlate.put(plate, vehicle);
                    vehiclesToSave.add(vehicle);

                }

                // Reativar veículo se foi soft-deletado em import anterior
                if (Boolean.FALSE.equals(vehicle.getActive()) || vehicle.getDeletedAt() != null) {
                    vehicle.setActive(true);
                    vehicle.setDeletedAt(null);
                    vehiclesToSave.add(vehicle);
                    vehiclesAdded++;
                    Map<String, String> d = new HashMap<>();
                    d.put("plate", plate);
                    d.put("name", vehicle.getInsuredName() != null ? vehicle.getInsuredName() : "");
                    addedDetails.add(d);
                } else if (!vehicleExisted) {
                    vehiclesAdded++;
                    Map<String, String> d = new HashMap<>();
                    d.put("plate", plate);
                    d.put("name", vehicle.getInsuredName() != null ? vehicle.getInsuredName() : "");
                    addedDetails.add(d);
                }

                linkedVehicles++;

                String numberStr =
                        getCellValue(row.getCell(4));

                Device device = devicesByNumberStr.get(numberStr);

                if (device == null) {
                    continue;
                }

                DeviceLinkage currentActiveLinkage =
                        activeLinkageByPlate.get(plate);

                if (currentActiveLinkage != null
                        && !currentActiveLinkage
                                .getDevice()
                                .getId()
                                .equals(device.getId())) {

                    // veículo já tem outro dispositivo ativo — troca de
                    // dispositivo precisa de aprovação, não troca direto
                    pendingChangeService.detect(
                            plate,
                            "dispositivo",
                            currentActiveLinkage
                                    .getDevice()
                                    .getNumberStr(),
                            device.getNumberStr(),
                            SOURCE_IMPORT
                    );

                    continue;

                }

                device.setVehicle(vehicle);

                devicesToSave.add(device);

                // Se currentActiveLinkage existe aqui, o device ja bateu
                // (gate acima), entao e' o mesmo registro que
                // findByVehicleAndDeviceAndActiveTrue(vehicle, device)
                // acharia — nao precisa de uma segunda busca.
                boolean isExistingLinkage = currentActiveLinkage != null;

                DeviceLinkage linkage =
                        isExistingLinkage
                                ? currentActiveLinkage
                                : DeviceLinkage.builder()
                                        .vehicle(vehicle)
                                        .device(device)
                                        .active(true)
                                        .build();

                // Captura estado anterior para detectar mudanças reais
                String prevManuf        = isExistingLinkage ? linkage.getManufacturer() : null;
                LocalDateTime prevStart = isExistingLinkage ? linkage.getStartAt()      : null;
                LocalDateTime prevEnd   = isExistingLinkage ? linkage.getEndAt()        : null;

                String newManuf        = getCellValue(row.getCell(6));
                LocalDateTime newStart = parseDate(getCellValue(row.getCell(0)));
                LocalDateTime newEnd   = parseDate(getCellValue(row.getCell(1)));

                // Já pode existir um vínculo criado pelo import de
                // Dispositivos (sem datas) — aqui completamos/atualizamos
                // as datas reais, sem nunca duplicar o registro.
                linkage.setManufacturer(newManuf);
                linkage.setStartAt(newStart);
                linkage.setEndAt(newEnd);

                linkagesToSave.add(linkage);
                activeLinkageByPlate.put(plate, linkage);

                if (isExistingLinkage) {
                    boolean manufChanged = !Objects.equals(newManuf,  prevManuf);
                    boolean startChanged = !Objects.equals(newStart,  prevStart);
                    boolean endChanged   = !Objects.equals(newEnd,    prevEnd);
                    if (manufChanged || startChanged || endChanged) {
                        linksChanged++;
                        String changedField = manufChanged ? "fabricante" : startChanged ? "data_inicio" : "data_fim";
                        String fromVal = manufChanged ? (prevManuf  != null ? prevManuf          : "")
                                       : startChanged ? (prevStart  != null ? prevStart.toString() : "")
                                       :               (prevEnd    != null ? prevEnd.toString()   : "");
                        String toVal   = manufChanged ? (newManuf   != null ? newManuf           : "")
                                       : startChanged ? (newStart   != null ? newStart.toString()  : "")
                                       :               (newEnd     != null ? newEnd.toString()    : "");
                        Map<String, Object> d = new HashMap<>();
                        d.put("plate", plate);
                        d.put("field", changedField);
                        d.put("from",  fromVal);
                        d.put("to",    toVal);
                        changedDetails.add(d);
                    }
                }

                active++;
                imported++;

            }

            workbook.close();

            if (!vehiclesToSave.isEmpty()) {
                vehicleRepository.saveAll(vehiclesToSave);
            }

            if (!devicesToSave.isEmpty()) {
                deviceRepository.saveAll(devicesToSave);
            }

            if (!linkagesToSave.isEmpty()) {
                repository.saveAll(linkagesToSave);
            }

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

            Map<String, Object> diffDetails = new HashMap<>();
            diffDetails.put("added",   addedDetails);
            diffDetails.put("removed", removedDetails);
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
            boolean hasRealChange = vehiclesAdded > 0 || vehiclesRemoved > 0 || linksChanged > 0;

            LocalDateTime diffCreatedAt = LocalDateTime.now(ZoneOffset.UTC);

            diffLogRepository.save(ImportDiffLog.builder()
                    .importType(ImportType.MULTIPORTAL_LINKAGE)
                    .added(vehiclesAdded)
                    .removed(vehiclesRemoved)
                    .changed(linksChanged)
                    .detailsJson(detailsJson)
                    .dismissed(!hasRealChange)
                    .dismissedAt(hasRealChange ? null : diffCreatedAt)
                    .createdAt(diffCreatedAt)
                    .build());

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

    // Chamado quando a planilha de vínculo traz status != "Aberto" para uma
    // placa. Desativa o device_linkage ativo (se existir, via o mapa em
    // memoria) e, em seguida, soft-deleta o veículo caso ele ainda
    // estivesse ativo. Retorna true se o veículo foi efetivamente
    // desativado. Acumula nas listas toSave em vez de salvar direto.
    private boolean deactivateVehicleIfOrphaned(
            Vehicle vehicle,
            Map<String, DeviceLinkage> activeLinkageByPlate,
            List<DeviceLinkage> linkagesToSave,
            List<Vehicle> vehiclesToSave
    ) {

        DeviceLinkage activeLinkage = activeLinkageByPlate.get(vehicle.getPlate());

        if (activeLinkage != null) {
            activeLinkage.setActive(false);
            if (activeLinkage.getEndAt() == null) {
                activeLinkage.setEndAt(LocalDateTime.now(ZoneOffset.UTC));
            }
            linkagesToSave.add(activeLinkage);
            activeLinkageByPlate.remove(vehicle.getPlate());
        }

        if (Boolean.TRUE.equals(vehicle.getActive())) {
            vehicle.setActive(false);
            vehicle.setDeletedAt(LocalDateTime.now(ZoneOffset.UTC));
            vehiclesToSave.add(vehicle);
            return true;
        }

        return false;

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
