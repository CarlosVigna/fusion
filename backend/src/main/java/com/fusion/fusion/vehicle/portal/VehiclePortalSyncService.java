package com.fusion.fusion.vehicle.portal;

import com.fusion.fusion.common.exception.ResourceNotFoundException;
import com.fusion.fusion.policy.PolicyService;
import com.fusion.fusion.vehicle.PlateValidator;
import com.fusion.fusion.vehicle.Vehicle;
import com.fusion.fusion.vehicle.VehicleGroup;
import com.fusion.fusion.vehicle.VehicleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

// Enriquece o cadastro de veiculos com dados do portal parceiro (mesma
// fonte que PolicyService.fetchFromPortal() ja usa pras apolices), mas
// nunca aplica direto — toda diferenca vira um VehiclePortalDiff
// pendente de aprovacao manual (ver accept()/reject()/acceptAll()).
@Slf4j
@Service
@RequiredArgsConstructor
public class VehiclePortalSyncService {

    private final VehicleRepository vehicleRepository;

    private final PolicyService policyService;

    private final VehiclePortalDiffRepository diffRepository;

    private static final Set<String> ACCEPTED_PORTAL_STATUSES =
            Set.of("APOLICE_EMITIDA", "APOLICE_VIGENTE");

    // Mesmo padrao do PolicyService.verificationJobs — job em memoria,
    // aceitavel perder no restart (pior caso: usuario clica em
    // "Sincronizar com Portal" de novo).
    private final ConcurrentHashMap<String, VehiclePortalSyncJob> jobs =
            new ConcurrentHashMap<>();

    public String startAsync() {

        String jobId = UUID.randomUUID().toString();

        jobs.put(jobId, new VehiclePortalSyncJob("RUNNING", 0, 0, null));

        runAsync(jobId);

        return jobId;

    }

    public VehiclePortalSyncJob getStatus(String jobId) {
        return jobs.getOrDefault(jobId, new VehiclePortalSyncJob("NOT_FOUND", 0, 0, null));
    }

    @Async
    public void runAsync(String jobId) {

        try {

            syncAll(jobId);

        } catch (Exception e) {

            log.error("[VEHICLE-PORTAL-SYNC] Erro fatal no job {}: {}", jobId, e.getMessage(), e);

            jobs.put(jobId, new VehiclePortalSyncJob("ERROR", 0, 0, null));

        }

    }

    // Sem @Transactional envolvendo o loop inteiro de proposito — cada
    // iteracao faz uma chamada HTTP bloqueante ao portal, e segurar uma
    // unica transacao/conexao aberta por todo esse tempo (varios
    // minutos pra centenas de veiculos) e' o mesmo anti-padrao que
    // OperationalStateEngineService evita isolando por veiculo. Aqui
    // cada .save() já e' sua propria transacao (proxy do Spring Data).
    public VehiclePortalSyncSummary syncAll(String jobId) {

        List<Vehicle> vehicles = vehicleRepository.findAll().stream()
                .filter(v -> v.getDeletedAt() == null)
                .filter(v -> Boolean.TRUE.equals(v.getActive()))
                .filter(v -> v.getVehicleGroup() == VehicleGroup.OPERATIONAL)
                .filter(v -> PlateValidator.isStandardFormat(v.getPlate()))
                .toList();

        int total = vehicles.size();
        int checked = 0;
        int withDiff = 0;
        int diffsCreated = 0;
        Set<String> fieldsChanged = new LinkedHashSet<>();

        for (Vehicle vehicle : vehicles) {

            checked++;

            if (jobId != null) {
                jobs.put(jobId, new VehiclePortalSyncJob("RUNNING", checked, total, null));
            }

            try {

                Map<String, Object> item = findBestPortalItem(vehicle.getPlate());

                vehicle.setLastPortalSync(LocalDateTime.now(ZoneOffset.UTC));

                if (item == null) {
                    vehicleRepository.save(vehicle);
                    continue;
                }

                vehicle.setPortalPolicyStatus(str(item.get("status")));

                List<FieldDiff> diffs = compareFields(vehicle, item);

                vehicleRepository.save(vehicle);

                if (!diffs.isEmpty()) {
                    withDiff++;
                }

                for (FieldDiff diff : diffs) {

                    boolean alreadyPending = diffRepository
                            .findByVehicleAndFieldAndNewValueAndAcceptedAtIsNullAndRejectedAtIsNull(
                                    vehicle, diff.field(), diff.newValue()
                            )
                            .isPresent();

                    if (alreadyPending) {
                        continue;
                    }

                    diffRepository.save(VehiclePortalDiff.builder()
                            .vehicle(vehicle)
                            .plate(vehicle.getPlate())
                            .field(diff.field())
                            .currentValue(diff.currentValue())
                            .newValue(diff.newValue())
                            .build());

                    diffsCreated++;
                    fieldsChanged.add(diff.field());

                }

            } catch (Exception e) {

                log.warn("[VEHICLE-PORTAL-SYNC] Falha ao sincronizar placa {}: {}",
                        vehicle.getPlate(), e.getMessage());

            }

        }

        VehiclePortalSyncSummary summary = new VehiclePortalSyncSummary(
                checked, withDiff, diffsCreated, List.copyOf(fieldsChanged)
        );

        if (jobId != null) {
            jobs.put(jobId, new VehiclePortalSyncJob("DONE", total, total, summary));
        }

        log.info("[VEHICLE-PORTAL-SYNC] Concluido — checados={} comDiferenca={} diffsCriados={}",
                checked, withDiff, diffsCreated);

        return summary;

    }

    public List<VehiclePortalDiffResponse> findPendingDiffs() {

        return diffRepository.findByAcceptedAtIsNullAndRejectedAtIsNullOrderByDetectedAtDesc()
                .stream()
                .map(VehiclePortalDiffResponse::from)
                .toList();

    }

    @Transactional
    public VehiclePortalDiffResponse accept(Long id) {

        VehiclePortalDiff diff = findDiffOrThrow(id);

        applyField(diff.getVehicle(), diff.getField(), diff.getNewValue());

        vehicleRepository.save(diff.getVehicle());

        diff.setAcceptedAt(LocalDateTime.now(ZoneOffset.UTC));

        diffRepository.save(diff);

        return VehiclePortalDiffResponse.from(diff);

    }

    @Transactional
    public VehiclePortalDiffResponse reject(Long id) {

        VehiclePortalDiff diff = findDiffOrThrow(id);

        diff.setRejectedAt(LocalDateTime.now(ZoneOffset.UTC));

        diffRepository.save(diff);

        return VehiclePortalDiffResponse.from(diff);

    }

    @Transactional
    public int acceptAll() {

        List<VehiclePortalDiff> pending = diffRepository
                .findByAcceptedAtIsNullAndRejectedAtIsNullOrderByDetectedAtDesc();

        for (VehiclePortalDiff diff : pending) {

            applyField(diff.getVehicle(), diff.getField(), diff.getNewValue());

            vehicleRepository.save(diff.getVehicle());

            diff.setAcceptedAt(LocalDateTime.now(ZoneOffset.UTC));

            diffRepository.save(diff);

        }

        return pending.size();

    }

    private VehiclePortalDiff findDiffOrThrow(Long id) {

        return diffRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Diferença não encontrada: " + id));

    }

    private void applyField(Vehicle vehicle, String field, String newValue) {

        switch (field) {
            case "city" -> vehicle.setCity(newValue);
            case "state" -> vehicle.setState(newValue);
            case "zipCode" -> vehicle.setZipCode(newValue);
            case "cpfCnpj" -> vehicle.setCpfCnpj(newValue);
            case "portalPolicyNumber" -> vehicle.setPortalPolicyNumber(newValue);
            case "portalStartDate" -> vehicle.setPortalStartDate(parsePortalDate(newValue));
            case "portalEndDate" -> vehicle.setPortalEndDate(parsePortalDate(newValue));
            case "vehicleModel" -> vehicle.setVehicleModel(newValue);
            case "vehicleBrand" -> vehicle.setVehicleBrand(newValue);
            default -> log.warn("[VEHICLE-PORTAL-SYNC] Campo desconhecido ao aplicar diff: {}", field);
        }

    }

    private Map<String, Object> findBestPortalItem(String plate) {

        List<Map<String, Object>> items = policyService.fetchRawPolicyItems(plate);

        return items.stream()
                .filter(i -> ACCEPTED_PORTAL_STATUSES.contains(String.valueOf(i.get("status"))))
                .findFirst()
                .orElse(null);

    }

    private record FieldDiff(String field, String currentValue, String newValue) {}

    private List<FieldDiff> compareFields(Vehicle vehicle, Map<String, Object> item) {

        List<FieldDiff> diffs = new ArrayList<>();

        addDiffIfChanged(diffs, "city", vehicle.getCity(), str(item.get("cidade")));
        addDiffIfChanged(diffs, "state", vehicle.getState(), str(item.get("estado")));
        addDiffIfChanged(diffs, "zipCode", vehicle.getZipCode(), str(item.get("cep_pernoite")));
        addDiffIfChanged(diffs, "cpfCnpj", vehicle.getCpfCnpj(), str(item.get("cpf_cnpj")));
        addDiffIfChanged(diffs, "portalPolicyNumber", vehicle.getPortalPolicyNumber(), str(item.get("numero_apolice")));
        addDiffIfChanged(diffs, "portalStartDate", isoOrNull(vehicle.getPortalStartDate()),
                isoOrNull(parsePortalDate(str(item.get("inicio_vigencia")))));
        addDiffIfChanged(diffs, "portalEndDate", isoOrNull(vehicle.getPortalEndDate()),
                isoOrNull(parsePortalDate(str(item.get("fim_vigencia")))));
        addDiffIfChanged(diffs, "vehicleModel", vehicle.getVehicleModel(), str(item.get("veiculo_modelo")));
        addDiffIfChanged(diffs, "vehicleBrand", vehicle.getVehicleBrand(), str(item.get("veiculo_marca")));

        return diffs;

    }

    private void addDiffIfChanged(List<FieldDiff> diffs, String field, String currentValue, String newValue) {

        String cur = blankToNull(currentValue);
        String neu = blankToNull(newValue);

        // Portal nao trouxe valor pra esse campo — nada a propor.
        if (neu == null) return;

        if (!neu.equals(cur)) {
            diffs.add(new FieldDiff(field, cur, neu));
        }

    }

    private String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }

    private String str(Object o) {
        return o != null ? String.valueOf(o) : null;
    }

    private String isoOrNull(LocalDate date) {
        return date != null ? date.toString() : null;
    }

    private LocalDate parsePortalDate(String raw) {

        if (raw == null || raw.isBlank()) return null;

        try {
            return LocalDate.parse(raw);
        } catch (Exception e) {
            log.warn("[VEHICLE-PORTAL-SYNC] Falha ao parsear data do portal: {}", raw);
            return null;
        }

    }

}
