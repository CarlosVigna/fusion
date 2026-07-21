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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
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

    private static final List<String> INDEVIDOS_2026_07_21 = List.of(
            "BBP3B50", "BCX1011", "BDI2E74", "BEN4C72", "DTA1G77", "ELL4B38", "FAM5G66",
            "FFM0533", "FQE3A32", "GJP0F98", "IXT7I26", "JAC7I62", "JAJ1E90", "JBX3J00",
            "EYQ5993", "FWQ6628", "GCZ5B67", "GHI1010"
    );

    private static final List<String> SUSPECT_PLATES = List.of(
            "BBP3B50", "BCX1011", "BDI2E74", "BEN4C72", "DTA1G77", "ELL4B38", "FAM5G66",
            "FFM0533", "FQE3A32", "GJP0F98", "IXT7I26", "JAC7I62", "JAJ1E90", "JBX3J00",
            "EYQ5993", "FWQ6628", "GCZ5B67", "GHI1010",
            "DKU9B11", "QCV2E16", "SWI4I26"
    );

    @PostMapping("/reactivate-vehicles")
    public Map<String, Object> reactivateVehicles() {
        String sql = """
                UPDATE vehicles
                SET active = true, deleted_at = NULL
                WHERE deleted_at::date = '2026-07-21'
                AND plate IN (:plates)
                """;
        int updated = jdbcTemplate.update(sql, new MapSqlParameterSource("plates", INDEVIDOS_2026_07_21));
        return Map.of("updated", updated, "plates", INDEVIDOS_2026_07_21);
    }

    @GetMapping("/check-plates")
    public List<Map<String, Object>> checkPlates() {

        // plate (upper) → active linkage
        Map<String, DeviceLinkage> linkageByPlate = new HashMap<>();
        for (DeviceLinkage dl : deviceLinkageRepository.findAllActiveWithVehicleAndDevice()) {
            if (dl.getVehicle() != null && dl.getVehicle().getPlate() != null) {
                linkageByPlate.putIfAbsent(dl.getVehicle().getPlate().toUpperCase(), dl);
            }
        }

        // plate (upper) → best policy status
        Map<String, PolicyStatus> policyStatusByPlate = new HashMap<>();
        for (Policy p : policyRepository.findAll()) {
            if (p.getPlate() == null) continue;
            String key = p.getPlate().toUpperCase();
            PolicyStatus status = PolicyResponse.computeStatus(p);
            PolicyStatus existing = policyStatusByPlate.get(key);
            if (existing == null) {
                policyStatusByPlate.put(key, status);
            } else {
                boolean newActive  = status == PolicyStatus.ACTIVE || status == PolicyStatus.EXPIRING || status == PolicyStatus.FUTURE;
                boolean prevActive = existing == PolicyStatus.ACTIVE || existing == PolicyStatus.EXPIRING || existing == PolicyStatus.FUTURE;
                if (newActive && !prevActive) policyStatusByPlate.put(key, status);
            }
        }

        return SUSPECT_PLATES.stream().map(plate -> {
            String key = plate.toUpperCase();
            Optional<Vehicle> opt = vehicleRepository.findByPlate(plate);
            DeviceLinkage dl = linkageByPlate.get(key);
            PolicyStatus ps = policyStatusByPlate.get(key);

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("plate", plate);

            if (opt.isEmpty()) {
                row.put("exists", false);
                row.put("active", null);
                row.put("deletedAt", null);
                row.put("hasEverCommunicated", null);
                row.put("vehicleGroup", null);
            } else {
                Vehicle v = opt.get();
                row.put("exists", true);
                row.put("active", v.getActive());
                row.put("deletedAt", v.getDeletedAt());
                row.put("hasEverCommunicated", v.getHasEverCommunicated());
                row.put("vehicleGroup", v.getVehicleGroup() != null ? v.getVehicleGroup().name() : null);
            }

            row.put("activeLinkage", dl != null);
            row.put("deviceNumber", dl != null && dl.getDevice() != null ? dl.getDevice().getNumberStr() : null);
            row.put("policyStatus", ps != null ? ps.name() : null);

            return row;
        }).toList();

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

        // "Ã" sozinho da falso positivo em nomes corretos (ex: GALVÃO,
        // GUIMARÃES ja sao grafias corretas — "ÃO"/"ÃES" e final valido
        // em portugues). Mojibake de verdade sempre tem um simbolo
        // Latin-1 improvavel logo depois (©, ¡, ³, º, §, ¢, ª), que e o
        // segundo byte UTF-8 de a/e/i/o/u/c acentuado lido como Latin-1.
        // Monta os pares corrompidos por codigo numerico (char) 0x00XX em
        // vez de literal acentuado no .java — evita depender do encoding
        // de leitura do proprio arquivo fonte pelo compilador/IDE, o que
        // seria ironico justamente numa investigacao de bug de encoding.
        char c3 = (char) 0x00C3; // "Ã" — primeiro byte UTF-8 de a/e/i/o/u/c acentuado, lido como Latin-1

        String moji_a = "" + c3 + (char) 0x00A1; // "a" corrompido (a acentuado)
        String moji_e = "" + c3 + (char) 0x00A9; // "e" corrompido (e acentuado)
        String moji_i = "" + c3 + (char) 0x00AD; // "i" corrompido (i acentuado)
        String moji_o = "" + c3 + (char) 0x00B3; // "o" corrompido (o acentuado)
        String moji_u = "" + c3 + (char) 0x00BA; // "u" corrompido (u acentuado)
        String moji_c = "" + c3 + (char) 0x00A7; // "c" corrompido (c cedilha)
        String moji_A = "" + c3 + (char) 0x00A2; // "a" corrompido (a circunflexo)
        String moji_E = "" + c3 + (char) 0x00AA; // "e" corrompido (e circunflexo)

        String mojibakeFilter =
                "(insured_name LIKE '%" + moji_a + "%' OR insured_name LIKE '%" + moji_e + "%' "
                        + "OR insured_name LIKE '%" + moji_i + "%' OR insured_name LIKE '%" + moji_o + "%' "
                        + "OR insured_name LIKE '%" + moji_u + "%' OR insured_name LIKE '%" + moji_c + "%' "
                        + "OR insured_name LIKE '%" + moji_A + "%' OR insured_name LIKE '%" + moji_E + "%')";

        List<Map<String, Object>> suspectPolicyNames = jdbcTemplate.queryForList(
                "SELECT id, plate, insured_name FROM policies WHERE "
                        + mojibakeFilter + " LIMIT 20",
                Map.of()
        );

        List<Map<String, Object>> suspectVehicleNames = jdbcTemplate.queryForList(
                "SELECT id, plate, insured_name FROM vehicles WHERE "
                        + mojibakeFilter + " LIMIT 20",
                Map.of()
        );

        List<Map<String, Object>> repairedPolicyNames = suspectPolicyNames.stream()
                .map(this::withRepairedGuess)
                .toList();

        List<Map<String, Object>> repairedVehicleNames = suspectVehicleNames.stream()
                .map(this::withRepairedGuess)
                .toList();

        return Map.of(
                "server_encoding", serverEncoding,
                "client_encoding", clientEncoding,
                "suspectPolicyNames", repairedPolicyNames,
                "suspectVehicleNames", repairedVehicleNames
        );

    }

    private Map<String, Object> withRepairedGuess(Map<String, Object> row) {

        Map<String, Object> copy = new HashMap<>(row);

        String repaired = repairMojibake((String) row.get("insured_name"));

        copy.put("repaired_guess", repaired);

        char replacementChar = (char) 0xFFFD; // U+FFFD, aparece quando o "reparo" gera lixo

        copy.put(
                "repair_plausible",
                repaired != null && repaired.indexOf(replacementChar) == -1
        );

        return copy;

    }

    // Tentativa de reverter o mojibake classico "UTF-8 lido como
    // Latin-1/Windows-1252" (ex: "JosÃ©" -> "José"). So serve de
    // diagnostico — se o texto original nao seguiu esse padrao, o
    // "reparo" sai lixo (contem U+FFFD) e isso por si so descarta essa
    // hipotese pra aquela linha.
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
