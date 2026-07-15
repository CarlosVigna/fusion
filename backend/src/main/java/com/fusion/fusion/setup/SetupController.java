package com.fusion.fusion.setup;

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
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/setup")
@RequiredArgsConstructor
public class SetupController {

    private final NamedParameterJdbcTemplate jdbcTemplate;

    private final VehicleRepository vehicleRepository;
    private final DeviceLinkageRepository deviceLinkageRepository;
    private final OperationalSnapshotRepository operationalSnapshotRepository;
    private final VehicleObservationService vehicleObservationService;
    private final LetterRecordRepository letterRecordRepository;
    private final PolicyRepository policyRepository;

    private static final List<String> INVALID_PLATES = List.of(
            "000555", "ADMILBRASILIA0101", "USE"
    );

    private static final List<String> TEST_PLATES = List.of(
            "ABC0707", "COMBURIU9999", "CURITIBA1515", "FRANCKCAMPINAS0101", "ITU0202",
            "LINKS-BAU", "LINKS-CARU", "LINKS-FEIRA", "LINKS-FORTA", "LINKS-INDAIA",
            "LINKS-ITA", "LINKS-ITUM", "LINKS-JOIN", "LINKS-JP0101", "LINKS-LON",
            "LINKS-MARIL", "LINKS-MARIN", "LINKS-PIRA", "MARCELO0101", "NATAL0101",
            "PELOTAS1030", "RIOPRETO0101"
    );

    private static final List<String> PLATES = List.of(
            "ADD7D00", "AYX1G79", "BBJ9286", "BBW9E09", "BDH8E98", "CUJ2I68", "DUM8500",
            "EIH2C89", "ETY9707", "EWN5793", "EWW2446", "FBI6046", "FMZ9J85", "FQB4B36",
            "GBL5519", "GDI4977", "GHI1010", "HIV5C16", "HIV5C64", "IXK7C35", "IYF1335",
            "IYJ4B45", "IYJ5F45", "MMI8D19", "OKD2J08", "OYX2819", "OZL9H95", "PCQ5E06",
            "PED2233", "PQA8A79", "QGZ8D98", "QNL5349", "QQW1H80", "QQY9B48", "QUP8A07",
            "QWK4208", "RFQ1G43", "RGU1F61", "RHO1C11", "RMG0E43", "RMQ1H71", "RRQ7G89",
            "RTO3A77", "RYB7J71", "RZE1J10", "RZG3C83", "SEI6G41", "SEN6A48", "SIG7I46",
            "SJD0B58", "SNR3I18", "SOB7C05", "SSX7D85", "SYB2E37", "TCJ8G60", "TKB7H57",
            "EHT2095", "EHT2A95"
    );

    @GetMapping("/check-plates")
    public Map<String, Object> checkPlates() {

        String sql = """
                SELECT plate, active, deleted_at, has_ever_communicated, created_at
                FROM vehicles
                WHERE plate IN (:plates)
                ORDER BY plate
                """;

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                sql,
                new MapSqlParameterSource("plates", PLATES)
        );

        List<String> found = rows.stream()
                .map(r -> (String) r.get("plate"))
                .toList();

        List<String> missing = PLATES.stream()
                .filter(p -> !found.contains(p))
                .toList();

        return Map.of("rows", rows, "missing", missing);

    }

    @PostMapping("/soft-delete-invalid-plates")
    public Map<String, Object> softDeleteInvalidPlates() {

        String sql = """
                UPDATE vehicles
                SET deleted_at = NOW(), active = false
                WHERE plate IN (:plates)
                """;

        int updated = jdbcTemplate.update(
                sql,
                new MapSqlParameterSource("plates", INVALID_PLATES)
        );

        return Map.of("updated", updated);

    }

    @GetMapping("/check-encoding")
    public Map<String, Object> checkEncoding() {

        Map<String, Object> serverEncoding = jdbcTemplate.queryForMap(
                "SHOW server_encoding", Map.of()
        );

        Map<String, Object> clientEncoding = jdbcTemplate.queryForMap(
                "SHOW client_encoding", Map.of()
        );

        List<Map<String, Object>> suspectPolicyNames = jdbcTemplate.queryForList(
                "SELECT id, plate, insured_name FROM policies "
                        + "WHERE insured_name LIKE '%Ã%' LIMIT 20",
                Map.of()
        );

        List<Map<String, Object>> suspectVehicleNames = jdbcTemplate.queryForList(
                "SELECT id, plate, insured_name FROM vehicles "
                        + "WHERE insured_name LIKE '%Ã%' LIMIT 20",
                Map.of()
        );

        List<Map<String, Object>> repairedPolicyNames = suspectPolicyNames.stream()
                .map(row -> {
                    Map<String, Object> copy = new HashMap<>(row);
                    copy.put("repaired_guess", repairMojibake((String) row.get("insured_name")));
                    return copy;
                })
                .toList();

        List<Map<String, Object>> repairedVehicleNames = suspectVehicleNames.stream()
                .map(row -> {
                    Map<String, Object> copy = new HashMap<>(row);
                    copy.put("repaired_guess", repairMojibake((String) row.get("insured_name")));
                    return copy;
                })
                .toList();

        return Map.of(
                "server_encoding", serverEncoding,
                "client_encoding", clientEncoding,
                "suspectPolicyNames", repairedPolicyNames,
                "suspectVehicleNames", repairedVehicleNames
        );

    }

    // Tentativa de reverter o mojibake classico "UTF-8 lido como
    // Latin-1/Windows-1252" (ex: "JosÃ©" -> "José"). So serve de
    // diagnostico — se o texto original nao seguiu esse padrao, o
    // "reparo" sai lixo e isso por si so descarta essa hipotese.
    private String repairMojibake(String text) {

        if (text == null) return null;

        try {
            return new String(
                    text.getBytes(StandardCharsets.ISO_8859_1),
                    StandardCharsets.UTF_8
            );
        } catch (Exception e) {
            return null;
        }

    }

    @GetMapping("/check-vehicles")
    public Map<String, Object> checkVehicles() {

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

        Map<String, Policy> activePolicyByPlate = buildActivePolicyByPlate();

        List<CheckVehicleRow> vehicles = vehicleRepository.findAll()
                .stream()
                .filter(vehicle -> vehicle.getDeletedAt() == null)
                .map(vehicle -> buildRow(
                        vehicle,
                        snapshotByVehicleId.get(vehicle.getId()),
                        activeLinkageByVehicleId.get(vehicle.getId()),
                        latestObservationByVehicleId.get(vehicle.getId()),
                        activeLetterByVehicleId.get(vehicle.getId()),
                        activePolicyByPlate.get(vehicle.getPlate().toUpperCase())
                ))
                .toList();

        List<Vehicle> testVehicles = vehicleRepository.findByPlateIn(TEST_PLATES);

        return Map.of("vehicles", vehicles, "testVehicles", testVehicles);

    }

    private Map<String, Policy> buildActivePolicyByPlate() {

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
            boolean newGood = status == PolicyStatus.ACTIVE || status == PolicyStatus.EXPIRING || status == PolicyStatus.FUTURE;
            boolean existingGood = existingStatus == PolicyStatus.ACTIVE || existingStatus == PolicyStatus.EXPIRING || existingStatus == PolicyStatus.FUTURE;

            if (newGood && !existingGood) {
                result.put(plate, policy);
            } else if (newGood && policy.getEndDate() != null
                    && (existing.getEndDate() == null || policy.getEndDate().isAfter(existing.getEndDate()))) {
                result.put(plate, policy);
            }

        }

        return result;

    }

    private CheckVehicleRow buildRow(
            Vehicle vehicle,
            OperationalSnapshot snapshot,
            DeviceLinkage activeLinkage,
            VehicleObservation lastObservation,
            LetterRecord activeLetter,
            Policy activePolicy
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

        String insuredName = activePolicy != null && activePolicy.getInsuredName() != null
                ? activePolicy.getInsuredName()
                : vehicle.getInsuredName();

        return new CheckVehicleRow(
                vehicle.getPlate(),
                numberStr,
                lastCommunicationAt != null ? lastCommunicationAt.toLocalDate() : null,
                lastCommunicationAt != null ? lastCommunicationAt.toLocalTime() : null,
                status.toString(),
                insuredName,
                activePolicy != null ? activePolicy.getPolicyNumber() : null,
                activePolicy != null ? activePolicy.getEndDate() : null,
                activePolicy != null ? activePolicy.getCpfCnpj() : null,
                vehicle.getVehicleGroup()
        );

    }

    private record CheckVehicleRow(
            String plate,
            String numberStr,
            LocalDate lastCommunicationDate,
            LocalTime lastCommunicationTime,
            String status,
            String insuredName,
            String policyNumber,
            LocalDate policyEndDate,
            String cpfCnpj,
            VehicleGroup vehicleGroup
    ) {
    }

}
