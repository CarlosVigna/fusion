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
import com.fusion.fusion.signalcontrol.SignalControlService;
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
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

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
    private final SignalControlService signalControlService;

    private static final Set<String> MULTIPORTAL_PLATES = Set.of(
        "FXZ9249", "QXX8I71", "FWQ9D54", "QWY7149", "QYJ4B61", "RXZ5F74", "SIE4D31", "TAP2C19", "PDH5I98", "TQU9E05",
        "SII1I58", "TRI6C75", "GJY1B69", "PCZ8923", "BZK4720", "JCN0H41", "FFM0533", "RZZ6I41", "SJA4F28", "UHM5I06",
        "JAC7I62", "RHM3J30", "UAC2E05", "UFO9B29", "UHM9G81", "BCE4I61", "QYD5I12", "SNM6H78", "IZE5G56", "BCL3653",
        "RTB4E98", "QYP6C20", "RMP4D44", "SGU7D79", "UHJ0B60", "PWI1I33", "EVD9I24", "BDI2E74", "SIC6J67", "RZV3A73",
        "EZY7717", "QQN1899", "QYZ7J23", "FHL4E40", "BEC6H32", "RUR1915", "UHJ0J32", "GJV0D63", "PLY6F74", "GIH6H97",
        "IPM5D84", "RFQ4G24", "QYP6D99", "TCV5B33", "SPB9I47", "SJB9J37", "ECQ3E25", "IXT7I26", "SYW1I29", "OMA1292",
        "RHK4A96", "QQQ4J75", "EDP2462", "RZM9J45", "RUB2C73", "SOX2I19", "SJC6C84", "JAJ1E90", "SNS6E03", "BCY0H12",
        "QYL3J49", "SDV4D17", "PZZ5D00", "RPL0F76", "PZQ9F38", "IYK8J46", "AQE5I57", "LTK6I71", "BDU9E61", "SPB4B48",
        "SHQ2E08", "QPR4C84", "UJA0E20", "RND7C82", "PDK9F20", "QYI6D47", "FQE3A32", "QNZ8D09", "SOV3E35", "PNA0B83",
        "AZN8438", "SPB7G51", "TQY2A49", "SUI7J11", "QOT6C47", "TCO0I35", "RZJ3I31", "TBD9H18", "ELU5644", "TOT3I36",
        "ORS0I80", "QOH7F43", "RTS6C57", "PTR0G45", "TTO9B59", "EUH2G33", "RVD8E86", "PCX6619", "SOE7I72", "PGG2752",
        "EJG0I65", "MKJ4F15", "BET3F56", "SIY1E67", "QYL2A27", "ITD7J68", "UAU0H64", "FAM5G66", "JCA6G37", "SHV2J78",
        "QUR8424", "BCX1011", "FAL4I25", "PDT7D53", "QYL1D28", "FRK8D68", "RFM4J29", "RGE2B55", "SUM2I94", "QYS2B16",
        "PKW8674", "RTN4E69", "IYA4B66", "JBW7H69", "SNK7E73", "IZU8E55", "RVP3F95", "QYT8A21", "FOW7B76", "RZL4F12",
        "PDT3D80", "PCE3B86", "RDK7F00", "RPS0A42", "SFB9B59", "BDK9B15", "QYO9J19", "PZB0H10", "SNX7J60", "SIZ3B73",
        "SII8H33", "SJB9J21", "FKO4H64", "RZO4B55", "SEG7D69", "SHS1I13", "RPW1H86", "FNM6056", "DKU9B11", "EYQ5993",
        "FWQ6628", "SWI4I26", "GCZ5B67", "QCV2E16", "OZQ0F42", "SVJ7B79", "PWC3754", "PCO1565", "GXF9E01", "PGF3212",
        "ARK2I09", "FZZ4A95", "SNM5H53", "BAU4706", "QNI2E71", "PCO8B10", "PVV8H48", "FPI8587", "IZS3I05", "SOZ1F21",
        "RHN5A17", "SIF5D90", "IYS7F64", "PGY0266", "FGF7611", "BBP3B50", "RZY8D64", "UGI2A38", "SYB4B23", "DTA1G77",
        "PDG8G36", "END5218", "FQM0H95", "SOL7E87", "PNZ0G68", "FKY5C72", "RJQ0C98", "FRT6789", "ELL4B38", "SJG2A22",
        "IZY7J82", "ECO9H70", "GJP0F98", "EME3E55", "SVN4A31", "BEN4C72", "QPC4G04", "AYW2J34", "IZL9I67", "FZW4095",
        "PZS5993", "CAM3I65", "BCL9B28", "RMV4F44", "QQC0G82", "STO4E84", "SOY0B11", "THS4J05", "SEE4J29", "SWN0E30",
        "FWN9J88", "SYS4J70", "PAROBE0101", "QWU0810", "SDR6E43", "SCF4J62", "SHR5C46", "FRS5547", "RGV8H21", "TZR1B88",
        "SHN5B82", "FPO5H30", "RTU9E00", "UDZ2C61", "RDG0C45", "QXQ7J07", "FFG6B53", "IWS1430", "RFQ1E88", "RTV6C09",
        "SIR7A26", "QNA2112", "RZU3F32", "GEU1E94", "QGS9J12", "QYM5I87", "TDZ4E23", "FIK3766", "SPA7J26", "QYT2I23",
        "RTC4J52", "JAE3E78", "UBV8F61", "QOM6H85", "QNB0C22", "BDD4I02", "SJD0B34", "GID6I45", "ABC0707",
        "FRANCKCAMPINAS0101", "ITU0202", "LINKS-BAU", "LINKS-CARU", "LINKS-FEIRA", "LINKS-INDAIA", "LINKS-ITA",
        "LINKS-ITUM", "LINKS-JOIN", "LINKS-LON", "LINKS-MARIL", "LINKS-MARIN", "NATAL0101", "TESTEBLU",
        "PGY3G49", "SPB8C78", "OGF5D31", "SJD9I96", "IWQ1461", "TCB1G90", "BDB7E94", "PRH3J98", "SHL9E21",
        "RUO2I25", "SIR7H01", "JCD7I80", "PDU8J85", "RMV9H81"
    );

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

    @GetMapping("/compare-grid")
    public Map<String, Object> compareGrid() {

        Set<String> fusionPlates = vehicleRepository.findAll().stream()
                .filter(v -> v.getDeletedAt() == null)
                .map(v -> v.getPlate().toUpperCase())
                .collect(Collectors.toSet());

        Set<String> signalControlPlates = signalControlService.findAll(true).stream()
                .map(r -> r.plate().toUpperCase())
                .collect(Collectors.toSet());

        List<String> apenasNoMultiportal = MULTIPORTAL_PLATES.stream()
                .filter(p -> !fusionPlates.contains(p))
                .sorted()
                .collect(Collectors.toList());

        List<String> apenasNoFusion = fusionPlates.stream()
                .filter(p -> !MULTIPORTAL_PLATES.contains(p))
                .sorted()
                .collect(Collectors.toList());

        List<String> emAmbos = MULTIPORTAL_PLATES.stream()
                .filter(fusionPlates::contains)
                .sorted()
                .collect(Collectors.toList());

        List<String> naoNoControleSinais = emAmbos.stream()
                .filter(p -> !signalControlPlates.contains(p))
                .sorted()
                .collect(Collectors.toList());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalMultiportal", MULTIPORTAL_PLATES.size());
        result.put("totalFusion", fusionPlates.size());
        result.put("emAmbos", emAmbos);
        result.put("apenasNoMultiportal", apenasNoMultiportal);
        result.put("apenasNoFusion", apenasNoFusion);
        result.put("naoNoControleSinais", naoNoControleSinais);
        return result;

    }

}
