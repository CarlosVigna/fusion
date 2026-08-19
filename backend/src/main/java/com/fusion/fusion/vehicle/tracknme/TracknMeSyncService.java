package com.fusion.fusion.vehicle.tracknme;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fusion.fusion.importation.ImportDiffLog;
import com.fusion.fusion.importation.ImportDiffLogRepository;
import com.fusion.fusion.importation.ImportType;
import com.fusion.fusion.operational.snapshot.OperationalSnapshot;
import com.fusion.fusion.operational.snapshot.OperationalSnapshotRepository;
import com.fusion.fusion.vehicle.Vehicle;
import com.fusion.fusion.vehicle.VehicleGroup;
import com.fusion.fusion.vehicle.VehiclePlatform;
import com.fusion.fusion.vehicle.VehicleRepository;
import com.fusion.fusion.vehicle.operational.CommunicationStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class TracknMeSyncService {

    private final TracknMeApiService apiService;
    private final VehicleRepository vehicleRepository;
    private final OperationalSnapshotRepository snapshotRepository;
    private final ImportDiffLogRepository diffLogRepository;

    private static final ObjectMapper MAPPER = new ObjectMapper();

    public void syncDevicesScheduled() {
        log.info("[TracknMe] Sync de dispositivos iniciado (manual)");
        syncDevices();
    }

    public void syncPositionsScheduled() {
        log.info("[TracknMe] Sync de posições iniciado (manual)");
        syncPositions();
    }

    public void syncDevices() {
        try {
            String token = apiService.authenticate();
            List<TracknMeDeviceItem> apiDevices = apiService.fetchDevices(token);

            // Mapeia label (placa normalizada) → deviceItem
            Map<String, TracknMeDeviceItem> apiByPlate = new LinkedHashMap<>();
            for (TracknMeDeviceItem d : apiDevices) {
                String normalized = normalizePlate(d.label());
                if (!normalized.isBlank()) {
                    apiByPlate.put(normalized, d);
                }
            }

            // Veículos TRACKNME já existentes no banco
            List<Vehicle> existing = vehicleRepository.findAll().stream()
                    .filter(v -> v.getVehicleGroup() == VehicleGroup.TRACKNME)
                    .toList();

            Map<String, Vehicle> dbByPlate = new LinkedHashMap<>();
            for (Vehicle v : existing) {
                dbByPlate.put(v.getPlate().toUpperCase(), v);
            }

            int added = 0;
            int removed = 0;
            int unchanged = 0;

            List<Map<String, String>> addedDetails = new ArrayList<>();
            List<Map<String, String>> removedDetails = new ArrayList<>();

            // Upsert: para cada device da API
            for (Map.Entry<String, TracknMeDeviceItem> entry : apiByPlate.entrySet()) {
                String plate = entry.getKey();
                TracknMeDeviceItem d = entry.getValue();

                if (dbByPlate.containsKey(plate)) {
                    Vehicle v = dbByPlate.get(plate);
                    boolean changed = false;

                    // Atualiza deviceId se mudou
                    if (!d.id().equals(v.getTracknmeDeviceId())) {
                        v.setTracknmeDeviceId(d.id());
                        changed = true;
                    }

                    // Atualiza os demais dados do dispositivo sempre que
                    // mudarem — troca de chip/operadora/rastreador etc.
                    if (!Objects.equals(d.imei(), v.getTracknmeImei())) {
                        v.setTracknmeImei(d.imei());
                        changed = true;
                    }
                    if (!Objects.equals(d.model(), v.getTracknmeModel())) {
                        v.setTracknmeModel(d.model());
                        changed = true;
                    }
                    if (!Objects.equals(d.operator(), v.getTracknmeOperator())) {
                        v.setTracknmeOperator(d.operator());
                        changed = true;
                    }
                    if (!Objects.equals(d.simCard(), v.getTracknmeSimCard())) {
                        v.setTracknmeSimCard(d.simCard());
                        changed = true;
                    }
                    if (!Objects.equals(d.number(), v.getTracknmeNumber())) {
                        v.setTracknmeNumber(d.number());
                        changed = true;
                    }

                    // Reativa se estava soft-deleted
                    if (v.getDeletedAt() != null) {
                        v.setDeletedAt(null);
                        v.setActive(true);
                        changed = true;
                        added++;
                        addedDetails.add(Map.of("plate", plate, "model", nullSafe(d.model()), "imei", nullSafe(d.imei())));
                    } else {
                        unchanged++;
                    }

                    if (changed) vehicleRepository.save(v);
                } else {
                    // Novo veículo TracknMe
                    Vehicle v = Vehicle.builder()
                            .plate(plate)
                            .platform(VehiclePlatform.TRACKNME)
                            .vehicleGroup(VehicleGroup.TRACKNME)
                            .tracknmeDeviceId(d.id())
                            .tracknmeImei(d.imei())
                            .tracknmeModel(d.model())
                            .tracknmeOperator(d.operator())
                            .tracknmeSimCard(d.simCard())
                            .tracknmeNumber(d.number())
                            .build();
                    vehicleRepository.save(v);
                    added++;
                    addedDetails.add(Map.of("plate", plate, "model", nullSafe(d.model()), "imei", nullSafe(d.imei())));
                }
            }

            // Soft-delete: veículos no banco que não estão mais na API
            for (Map.Entry<String, Vehicle> entry : dbByPlate.entrySet()) {
                String plate = entry.getKey();
                if (!apiByPlate.containsKey(plate)) {
                    Vehicle v = entry.getValue();
                    if (v.getDeletedAt() == null) {
                        log.info("[TRACKNME-SYNC] Soft-deletando veículo ausente da API: {} (IMEI: {})",
                                v.getPlate(), v.getTracknmeImei());
                        v.setDeletedAt(LocalDateTime.now(ZoneOffset.UTC));
                        v.setActive(false);
                        vehicleRepository.save(v);
                        removed++;
                        removedDetails.add(Map.of("plate", plate));
                    }
                }
            }

            if (added > 0 || removed > 0) {
                Map<String, Object> details = new LinkedHashMap<>();
                details.put("added", addedDetails);
                details.put("removed", removedDetails);
                details.put("changed", List.of());

                ImportDiffLog diffLog = ImportDiffLog.builder()
                        .importType(ImportType.TRACKNME)
                        .added(added)
                        .removed(removed)
                        .changed(0)
                        .detailsJson(MAPPER.writeValueAsString(details))
                        .dismissed(false)
                        .createdAt(LocalDateTime.now(ZoneOffset.UTC))
                        .build();

                diffLogRepository.save(diffLog);
            }

            log.info("[TracknMe] Sync de dispositivos concluído — adicionados={} removidos={} inalterados={}",
                    added, removed, unchanged);

        } catch (Exception e) {
            log.error("[TracknMe] Erro no sync de dispositivos: {}", e.getMessage(), e);
        }
    }

    public void syncPositions() {
        try {
            String token = apiService.authenticate();

            List<Vehicle> tracknmeVehicles = vehicleRepository.findAll().stream()
                    .filter(v -> v.getVehicleGroup() == VehicleGroup.TRACKNME
                            && v.getDeletedAt() == null
                            && v.getTracknmeDeviceId() != null)
                    .toList();

            if (tracknmeVehicles.isEmpty()) {
                log.info("[TracknMe] Nenhum veículo TracknMe com deviceId para sync de posições");
                return;
            }

            Map<String, Vehicle> vehicleByDeviceId = new LinkedHashMap<>();
            List<String> deviceIds = new ArrayList<>();
            for (Vehicle v : tracknmeVehicles) {
                deviceIds.add(v.getTracknmeDeviceId());
                vehicleByDeviceId.put(v.getTracknmeDeviceId(), v);
            }

            List<TracknMePositionItem> positions = apiService.fetchPositions(token, deviceIds);

            int updated = 0;

            for (TracknMePositionItem pos : positions) {
                Vehicle vehicle = vehicleByDeviceId.get(pos.deviceId());
                if (vehicle == null) continue;

                LocalDateTime lastComm = parseDateTime(pos.dateTime());

                OperationalSnapshot snapshot = snapshotRepository
                        .findFirstByVehicle(vehicle)
                        .orElseGet(() -> OperationalSnapshot.builder().vehicle(vehicle).build());

                snapshot.setOnline(pos.online());
                snapshot.setLastCommunicationAt(lastComm);
                snapshot.setUpdatedAt(LocalDateTime.now(ZoneOffset.UTC));

                if (lastComm != null) {
                    long delayMin = java.time.Duration.between(lastComm, LocalDateTime.now(ZoneOffset.UTC)).toMinutes();
                    snapshot.setSignalDelayMinutes((int) delayMin);
                    if (pos.online() || delayMin <= 30) {
                        snapshot.setCommunicationStatus(CommunicationStatus.ONLINE);
                    } else if (delayMin <= 360) {
                        snapshot.setCommunicationStatus(CommunicationStatus.DELAYED);
                    } else {
                        snapshot.setCommunicationStatus(CommunicationStatus.NO_COMMUNICATION);
                    }
                }

                snapshotRepository.save(snapshot);

                if (!Boolean.TRUE.equals(vehicle.getHasEverCommunicated()) && lastComm != null) {
                    vehicle.setHasEverCommunicated(true);
                    vehicleRepository.save(vehicle);
                }

                updated++;
            }

            log.info("[TracknMe] Sync de posições concluído — {} veículos atualizados", updated);

        } catch (Exception e) {
            log.error("[TracknMe] Erro no sync de posições: {}", e.getMessage(), e);
        }
    }

    private LocalDateTime parseDateTime(String raw) {
        if (raw == null || raw.isBlank()) return null;

        // Formato real da API (confirmado): ISO com offset explicito,
        // ex "2026-08-10T22:56:52-03:00" — nenhum dos formatters ingenuos
        // abaixo da conta desse formato (LocalDateTime.parse rejeita o
        // "-03:00" no final), por isso "última comunicação" nunca era
        // preenchida. Converte pra UTC, igual todo o resto do sistema
        // guarda LocalDateTime.
        try {
            return java.time.OffsetDateTime.parse(raw)
                    .withOffsetSameInstant(ZoneOffset.UTC)
                    .toLocalDateTime();
        } catch (DateTimeParseException ignored) {}

        List<DateTimeFormatter> formatters = List.of(
                DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"),
                DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss"),
                DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss")
        );
        for (DateTimeFormatter fmt : formatters) {
            try {
                return LocalDateTime.parse(raw, fmt);
            } catch (DateTimeParseException ignored) {}
        }
        log.warn("[TracknMe] Formato de data não reconhecido: {}", raw);
        return null;
    }

    private String normalizePlate(String plate) {
        if (plate == null) return "";
        return plate.replace("-", "").replace(" ", "").trim().toUpperCase();
    }

    private String nullSafe(String value) {
        return value != null ? value : "";
    }

}
