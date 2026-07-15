package com.fusion.fusion.reports;

import com.fusion.fusion.letter.LetterRecord;
import com.fusion.fusion.letter.LetterRecordRepository;
import com.fusion.fusion.letter.LetterStatus;
import com.fusion.fusion.observation.VehicleObservation;
import com.fusion.fusion.observation.VehicleObservationService;
import com.fusion.fusion.operational.snapshot.OperationalSnapshot;
import com.fusion.fusion.operational.snapshot.OperationalSnapshotRepository;
import com.fusion.fusion.policy.Policy;
import com.fusion.fusion.policy.PolicyRepository;
import com.fusion.fusion.policy.PolicyResponse;
import com.fusion.fusion.policy.PolicyStatus;
import com.fusion.fusion.vehicle.Vehicle;
import com.fusion.fusion.vehicle.VehicleGroup;
import com.fusion.fusion.vehicle.VehicleRepository;
import com.fusion.fusion.vehicle.multiportal.linkage.DeviceLinkage;
import com.fusion.fusion.vehicle.multiportal.linkage.DeviceLinkageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class MultiportalSheetService {

    // Veiculos de teste usados para validar o pipeline de sync MULTIPORTAL
    // — ficam soft-deletados no banco, nunca aparecem nos blocos
    // operacionais, mas precisam ser conferidos manualmente (bloco tests).
    private static final List<String> TEST_PLATES = List.of(
            "ABC0707", "COMBURIU9999", "CURITIBA1515", "FRANCKCAMPINAS0101", "ITU0202",
            "LINKS-BAU", "LINKS-CARU", "LINKS-FEIRA", "LINKS-FORTA", "LINKS-INDAIA",
            "LINKS-ITA", "LINKS-ITUM", "LINKS-JOIN", "LINKS-JP0101", "LINKS-LON",
            "LINKS-MARIL", "LINKS-MARIN", "LINKS-PIRA", "MARCELO0101", "NATAL0101",
            "PELOTAS1030", "RIOPRETO0101"
    );

    private final VehicleRepository vehicleRepository;
    private final DeviceLinkageRepository deviceLinkageRepository;
    private final OperationalSnapshotRepository operationalSnapshotRepository;
    private final VehicleObservationService vehicleObservationService;
    private final LetterRecordRepository letterRecordRepository;
    private final PolicyRepository policyRepository;

    public MultiportalSheetResponse build() {

        Map<UUID, OperationalSnapshot> snapshotByVehicleId = new HashMap<>();

        for (OperationalSnapshot snapshot : operationalSnapshotRepository.findAll()) {
            if (snapshot.getVehicle() != null) {
                snapshotByVehicleId.put(snapshot.getVehicle().getId(), snapshot);
            }
        }

        Map<UUID, DeviceLinkage> activeLinkageByVehicleId = new HashMap<>();

        for (DeviceLinkage linkage : deviceLinkageRepository.findAllActiveWithVehicleAndDevice()) {
            if (linkage.getVehicle() != null) {
                activeLinkageByVehicleId.putIfAbsent(linkage.getVehicle().getId(), linkage);
            }
        }

        Map<UUID, VehicleObservation> latestObservationByVehicleId =
                vehicleObservationService.findLatestByVehicleId();

        Map<UUID, LetterRecord> activeLetterByVehicleId = new HashMap<>();

        for (LetterRecord letter : letterRecordRepository.findByStatusOrderByDataEnvioDesc(LetterStatus.ATIVA)) {
            if (letter.getVehicle() != null) {
                activeLetterByVehicleId.putIfAbsent(letter.getVehicle().getId(), letter);
            }
        }

        Map<String, Policy> policyByPlate = buildBestPolicyByPlate();

        List<Vehicle> activeVehicles = vehicleRepository.findAll()
                .stream()
                .filter(vehicle -> vehicle.getDeletedAt() == null)
                .sorted(Comparator.comparing(Vehicle::getPlate))
                .toList();

        List<Vehicle> operationalVehicles = activeVehicles.stream()
                .filter(vehicle -> Boolean.TRUE.equals(vehicle.getHasEverCommunicated())
                        && vehicle.getVehicleGroup() == VehicleGroup.OPERATIONAL)
                .toList();

        List<Vehicle> kakoVehicles = activeVehicles.stream()
                .filter(vehicle -> vehicle.getVehicleGroup() == VehicleGroup.KAKO)
                .toList();

        List<Vehicle> testVehicles = vehicleRepository.findByPlateIn(TEST_PLATES)
                .stream()
                .sorted(Comparator.comparing(Vehicle::getPlate))
                .toList();

        List<Vehicle> verificationVehicles = activeVehicles.stream()
                .filter(vehicle -> {
                    OperationalSnapshot snapshot = snapshotByVehicleId.get(vehicle.getId());
                    boolean noCommunication = snapshot == null || snapshot.getLastCommunicationAt() == null;
                    boolean noPolicy = policyByPlate.get(vehicle.getPlate().toUpperCase()) == null;
                    return noCommunication || noPolicy;
                })
                .toList();

        MultiportalBlocks blocks = new MultiportalBlocks(
                buildRows(operationalVehicles, "operational", snapshotByVehicleId, activeLinkageByVehicleId, latestObservationByVehicleId, activeLetterByVehicleId, policyByPlate),
                buildRows(kakoVehicles, "kako", snapshotByVehicleId, activeLinkageByVehicleId, latestObservationByVehicleId, activeLetterByVehicleId, policyByPlate),
                buildRows(testVehicles, "tests", snapshotByVehicleId, activeLinkageByVehicleId, latestObservationByVehicleId, activeLetterByVehicleId, policyByPlate),
                buildRows(verificationVehicles, "verification", snapshotByVehicleId, activeLinkageByVehicleId, latestObservationByVehicleId, activeLetterByVehicleId, policyByPlate)
        );

        return new MultiportalSheetResponse(blocks, LocalDateTime.now(ZoneOffset.UTC));

    }

    private List<MultiportalRow> buildRows(
            List<Vehicle> vehicles,
            String blockKey,
            Map<UUID, OperationalSnapshot> snapshotByVehicleId,
            Map<UUID, DeviceLinkage> activeLinkageByVehicleId,
            Map<UUID, VehicleObservation> latestObservationByVehicleId,
            Map<UUID, LetterRecord> activeLetterByVehicleId,
            Map<String, Policy> policyByPlate
    ) {

        List<MultiportalRow> rows = new ArrayList<>();

        for (Vehicle vehicle : vehicles) {

            rows.add(buildRow(
                    vehicle,
                    blockKey,
                    snapshotByVehicleId.get(vehicle.getId()),
                    activeLinkageByVehicleId.get(vehicle.getId()),
                    latestObservationByVehicleId.get(vehicle.getId()),
                    activeLetterByVehicleId.get(vehicle.getId()),
                    policyByPlate.get(vehicle.getPlate().toUpperCase())
            ));

        }

        return rows;

    }

    private Map<String, Policy> buildBestPolicyByPlate() {

        Map<String, Policy> result = new HashMap<>();

        for (Policy policy : policyRepository.findAll()) {

            if (policy.getPlate() == null) continue;

            String plate = policy.getPlate().toUpperCase();
            PolicyStatus status = PolicyResponse.computeStatus(policy);
            Policy existing = result.get(plate);

            if (existing == null) {
                result.put(plate, policy);
                continue;
            }

            PolicyStatus existingStatus = PolicyResponse.computeStatus(existing);
            boolean newGood = isCurrentStatus(status);
            boolean existingGood = isCurrentStatus(existingStatus);

            if (newGood && !existingGood) {
                result.put(plate, policy);
            } else if (newGood && policy.getEndDate() != null
                    && (existing.getEndDate() == null || policy.getEndDate().isAfter(existing.getEndDate()))) {
                result.put(plate, policy);
            }

        }

        return result;

    }

    private boolean isCurrentStatus(PolicyStatus status) {
        return status == PolicyStatus.ACTIVE
                || status == PolicyStatus.EXPIRING
                || status == PolicyStatus.FUTURE;
    }

    private MultiportalRow buildRow(
            Vehicle vehicle,
            String blockKey,
            OperationalSnapshot snapshot,
            DeviceLinkage activeLinkage,
            VehicleObservation lastObservation,
            LetterRecord activeLetter,
            Policy policy
    ) {

        String numberStr = activeLinkage != null && activeLinkage.getDevice() != null
                ? activeLinkage.getDevice().getNumberStr()
                : null;

        LocalDateTime lastCommunicationAt = snapshot != null ? snapshot.getLastCommunicationAt() : null;

        StringBuilder status = new StringBuilder();

        if (lastObservation != null && lastObservation.getText() != null) {
            status.append(lastObservation.getText());
        }

        if (activeLetter != null) {
            if (!status.isEmpty()) status.append(" ");
            status.append("#CARTASUSPENSAO");
        }

        if (Boolean.TRUE.equals(vehicle.getInMaintenance())) {
            if (!status.isEmpty()) status.append(" ");
            status.append("#MANUTENCAO");
        }

        String insuredName = policy != null && policy.getInsuredName() != null
                ? policy.getInsuredName()
                : vehicle.getInsuredName();

        return new MultiportalRow(
                vehicle.getPlate(),
                numberStr,
                lastCommunicationAt != null ? lastCommunicationAt.toLocalDate() : null,
                lastCommunicationAt != null ? lastCommunicationAt.toLocalTime() : null,
                status.toString(),
                insuredName,
                policy != null ? policy.getPolicyNumber() : null,
                policy != null ? policy.getEndDate() : null,
                policy != null ? policy.getCpfCnpj() : null,
                blockKey
        );

    }

}
