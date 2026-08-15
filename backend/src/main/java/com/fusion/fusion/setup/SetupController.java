package com.fusion.fusion.setup;

import com.fusion.fusion.etl.EtlHeartbeatRequest;
import com.fusion.fusion.etl.EtlRunStatus;
import com.fusion.fusion.etl.EtlStatusService;
import com.fusion.fusion.importation.ImportType;
import com.fusion.fusion.installation.Installation;
import com.fusion.fusion.installation.InstallationRepository;
import com.fusion.fusion.installation.InstallationSyncService;
import com.fusion.fusion.vehicle.tracknme.TracknMeSyncService;
import com.fusion.fusion.whatsapp.WhatsAppService;
import com.fusion.fusion.installation.InstallationStatus;
import com.fusion.fusion.letter.LetterRecord;
import com.fusion.fusion.letter.LetterRecordRepository;
import com.fusion.fusion.letter.LetterStatus;
import com.fusion.fusion.observation.VehicleObservation;
import com.fusion.fusion.observation.VehicleObservationService;
import com.fusion.fusion.operational.snapshot.OperationalSnapshot;
import com.fusion.fusion.operational.snapshot.OperationalSnapshotRepository;
import com.fusion.fusion.policy.Policy;
import com.fusion.fusion.serviceorder.ServiceOrderService;
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
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

// rebuild-marker: 2026-08-14
@Slf4j
@RestController
@RequestMapping("/setup")
@RequiredArgsConstructor
public class SetupController {

    private final NamedParameterJdbcTemplate jdbcTemplate;

    private final Environment env;

    private final InstallationSyncService installationSyncService;

    // Chama scheduledSync() diretamente (nao syncFromPortal()) pra
    // reproduzir exatamente o que o cron faz, inclusive o try-catch que
    // engole exceptions — se o problema for algo que so aparece por essa
    // via, esse endpoint reproduz. scheduledSync() e' void por ser
    // @Scheduled; o resultado real fica em getLastResult(), que so e'
    // atualizado no caminho de sucesso — se vier igual ao de antes da
    // chamada, o sync falhou (ver log [INSTALACOES] Erro no sync agendado
    // pra causa exata).
    @GetMapping("/force-installation-sync")
    public Map<String, Object> forceInstallationSync() {

        var before = installationSyncService.getLastResult();

        installationSyncService.scheduledSync();

        var after = installationSyncService.getLastResult();

        return Map.of(
                "changed", after != before,
                "lastResult", after != null ? after : Map.of()
        );

    }

    // env.getProperty() nao serve pra "configurado"/"AUSENTE" aqui:
    // portal.parceiro.client-id/secret tem fallback ${VAR:} no
    // application.properties, entao sem a env var no Railway a property
    // resolve pra "" (string vazia), nao null — != null sempre daria
    // "configurado" mesmo com a variavel ausente. Por isso checa isBlank().
    @GetMapping("/check-installation-config")
    public Map<String, Object> checkInstallationConfig() {
        return Map.of(
                "portalUrl", isConfigured("portal.parceiro.url") ? "configurado" : "AUSENTE",
                "clientId", isConfigured("portal.parceiro.client-id") ? "configurado" : "AUSENTE",
                "clientSecret", isConfigured("portal.parceiro.client-secret") ? "configurado" : "AUSENTE"
        );
    }

    private boolean isConfigured(String property) {
        String value = env.getProperty(property);
        return value != null && !value.isBlank();
    }

    @GetMapping("/ping")
    public Map<String, Object> ping() {
        return Map.of("pong", true, "v", "2");
    }

    private final VehicleRepository vehicleRepository;
    private final DeviceLinkageRepository deviceLinkageRepository;
    private final OperationalSnapshotRepository operationalSnapshotRepository;
    private final VehicleObservationService vehicleObservationService;
    private final LetterRecordRepository letterRecordRepository;
    private final PolicyRepository policyRepository;
    private final SignalControlService signalControlService;
    private final InstallationRepository installationRepository;
    private final ServiceOrderService serviceOrderService;
    private final TracknMeSyncService tracknMeSyncService;
    private final WhatsAppService whatsAppService;
    private final EtlStatusService etlStatusService;

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
        "RUO2I25", "SIR7H01", "JCD7I80", "PDU8J85", "RMV9H81",
        // adicionados na atualização de 2026-08-01
        "BCP1F49", "IXC2671", "JDL3I32", "TIY7C80", "TRJ9I53"
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

    private static final List<String> TEST_VEHICLE_PLATES_FIX = List.of(
            "ABC0707", "FRANCKCAMPINAS0101", "ITU0202", "LINKS-BAU", "LINKS-CARU",
            "LINKS-FEIRA", "LINKS-INDAIA", "LINKS-ITA", "LINKS-ITUM", "LINKS-JOIN",
            "LINKS-LON", "LINKS-MARIL", "LINKS-MARIN", "NATAL0101", "TESTEBLU",
            "COMBURIU9999", "CURITIBA1515", "LINKS-FORTA", "LINKS-JP0101",
            "LINKS-PIRA", "MARCELO0101", "PELOTAS1030", "RIOPRETO0101", "PAROBE0101"
    );

    private static final List<String> SETUP_PLATES_TO_DELETE = List.of(
            "000555", "ADMILBRASILIA0101", "USE"
    );

    @GetMapping("/fix-vehicle-group-constraint")
    public Map<String, Object> fixVehicleGroupConstraint() {
        jdbcTemplate.getJdbcTemplate().execute(
                "ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_vehicle_group_check"
        );
        jdbcTemplate.getJdbcTemplate().execute(
                "ALTER TABLE vehicles ADD CONSTRAINT vehicles_vehicle_group_check " +
                "CHECK (vehicle_group IN ('OPERATIONAL','KAKO','TEST','TRACKNME'))"
        );
        return Map.of("status", "ok", "message", "Constraint atualizada para incluir TRACKNME");
    }

    @PostMapping("/fix-vehicle-groups")
    public Map<String, Object> fixVehicleGroups() {

        // Expande o check constraint para aceitar TEST e TRACKNME
        jdbcTemplate.getJdbcTemplate().execute(
                "ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_vehicle_group_check"
        );
        jdbcTemplate.getJdbcTemplate().execute(
                "ALTER TABLE vehicles ADD CONSTRAINT vehicles_vehicle_group_check " +
                "CHECK (vehicle_group IN ('OPERATIONAL','KAKO','TEST','TRACKNME'))"
        );

        int testUpdated = jdbcTemplate.update(
                "UPDATE vehicles SET deleted_at = NULL, active = true, vehicle_group = 'TEST' WHERE plate IN (:plates)",
                new MapSqlParameterSource("plates", TEST_VEHICLE_PLATES_FIX)
        );

        int setupDeleted = jdbcTemplate.update(
                "UPDATE vehicles SET deleted_at = NOW(), active = false WHERE plate IN (:plates)",
                new MapSqlParameterSource("plates", SETUP_PLATES_TO_DELETE)
        );

        return Map.of(
                "testVehiclesUpdated", testUpdated,
                "setupVehiclesDeleted", setupDeleted,
                "testPlates", TEST_VEHICLE_PLATES_FIX,
                "deletedPlates", SETUP_PLATES_TO_DELETE
        );

    }

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

    private static final List<String> INSERT_TEST_PLATES = List.of(
            "ABC0707", "FRANCKCAMPINAS0101", "ITU0202", "LINKS-BAU", "LINKS-CARU",
            "LINKS-FEIRA", "LINKS-INDAIA", "LINKS-ITA", "LINKS-ITUM", "LINKS-JOIN",
            "LINKS-LON", "LINKS-MARIL", "LINKS-MARIN", "NATAL0101", "TESTEBLU"
    );

    @PostMapping("/insert-test-vehicles")
    public Map<String, Object> insertTestVehicles() {

        Set<String> existing = new java.util.HashSet<>(
                jdbcTemplate.queryForList(
                        "SELECT plate FROM vehicles WHERE plate IN (:plates)",
                        new MapSqlParameterSource("plates", INSERT_TEST_PLATES),
                        String.class
                )
        );

        int inserted = 0;
        int updated = 0;

        for (String plate : INSERT_TEST_PLATES) {
            if (!existing.contains(plate)) {
                jdbcTemplate.update(
                        "INSERT INTO vehicles (id, plate, vehicle_group, platform, active, has_ever_communicated, in_maintenance, created_at) " +
                        "VALUES (gen_random_uuid(), :plate, 'TEST', 'MULTIPORTAL', true, false, false, NOW())",
                        new MapSqlParameterSource("plate", plate)
                );
                inserted++;
            } else {
                int rows = jdbcTemplate.update(
                        "UPDATE vehicles SET vehicle_group = 'TEST', active = true, deleted_at = NULL WHERE plate = :plate AND vehicle_group != 'TEST'",
                        new MapSqlParameterSource("plate", plate)
                );
                if (rows > 0) updated++;
            }
        }

        return Map.of(
                "inserted", inserted,
                "updated", updated,
                "alreadyCorrect", INSERT_TEST_PLATES.size() - inserted - updated,
                "plates", INSERT_TEST_PLATES
        );

    }

    @GetMapping("/full-audit")
    public Map<String, Object> fullAudit() {

        List<Vehicle> allVehicles = vehicleRepository.findAll();

        Set<UUID> linkedVehicleIds = new java.util.HashSet<>();
        for (DeviceLinkage dl : deviceLinkageRepository.findAllActiveWithVehicleAndDevice()) {
            if (dl.getVehicle() != null) linkedVehicleIds.add(dl.getVehicle().getId());
        }

        List<Vehicle> active = allVehicles.stream()
                .filter(v -> v.getDeletedAt() == null)
                .toList();

        List<Vehicle> activeOp = active.stream()
                .filter(v -> v.getVehicleGroup() == VehicleGroup.OPERATIONAL)
                .toList();
        List<Vehicle> activeTest = active.stream()
                .filter(v -> v.getVehicleGroup() == VehicleGroup.TEST)
                .toList();
        List<Vehicle> activeKako = active.stream()
                .filter(v -> v.getVehicleGroup() == VehicleGroup.KAKO)
                .toList();
        List<Vehicle> softDeleted = allVehicles.stream()
                .filter(v -> v.getDeletedAt() != null)
                .toList();

        Set<String> fusionActivePlates = active.stream()
                .map(v -> v.getPlate().toUpperCase())
                .collect(Collectors.toSet());

        List<String> apenasNoMultiportal = MULTIPORTAL_PLATES.stream()
                .filter(p -> !fusionActivePlates.contains(p.toUpperCase()))
                .sorted()
                .toList();

        List<String> apenasNoFusion = active.stream()
                .filter(v -> v.getVehicleGroup() == VehicleGroup.OPERATIONAL
                        && !MULTIPORTAL_PLATES.contains(v.getPlate().toUpperCase()))
                .map(Vehicle::getPlate)
                .sorted()
                .toList();

        List<String> semDispositivo = activeOp.stream()
                .filter(v -> !linkedVehicleIds.contains(v.getId()))
                .map(Vehicle::getPlate)
                .sorted()
                .toList();

        List<String> semComunicacao = activeOp.stream()
                .filter(v -> !Boolean.TRUE.equals(v.getHasEverCommunicated()))
                .map(Vehicle::getPlate)
                .sorted()
                .toList();

        List<String> verificacao = activeOp.stream()
                .filter(v -> !linkedVehicleIds.contains(v.getId())
                        || !Boolean.TRUE.equals(v.getHasEverCommunicated()))
                .map(Vehicle::getPlate)
                .sorted()
                .toList();

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("totalMultiportal", MULTIPORTAL_PLATES.size());
        summary.put("totalFusionAtivos", active.size());
        summary.put("totalFusionOperacional", activeOp.size());
        summary.put("totalFusionTestes", activeTest.size());
        summary.put("totalFusionKako", activeKako.size());
        summary.put("totalFusionVerificacao", verificacao.size());
        summary.put("totalSoftDeletados", softDeleted.size());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("summary", summary);
        result.put("emAmbos", MULTIPORTAL_PLATES.size() - apenasNoMultiportal.size());
        result.put("apenasNoMultiportal", apenasNoMultiportal);
        result.put("apenasNoFusion", apenasNoFusion);
        result.put("testesNoFusion", activeTest.stream().map(Vehicle::getPlate).sorted().toList());
        result.put("kakoNoFusion", activeKako.stream().map(Vehicle::getPlate).sorted().toList());
        result.put("verificacao", verificacao);
        result.put("semDispositivo", semDispositivo);
        result.put("semComunicacao", semComunicacao);
        result.put("softDeletados", softDeleted.stream().map(Vehicle::getPlate).sorted().toList());
        return result;

    }

    @GetMapping("/test-nominatim")
    public Map<String, Object> testNominatim() {
        try {
            org.springframework.web.client.RestTemplate rt = new org.springframework.web.client.RestTemplate();
            HttpHeaders headers = new HttpHeaders();
            headers.set("User-Agent", "FusionApp/1.0 contact@fusion.com");
            org.springframework.http.HttpEntity<?> entity = new org.springframework.http.HttpEntity<>(headers);
            String url = "https://nominatim.openstreetmap.org/search?q=S%C3%A3o+Paulo%2C+SP%2C+Brasil&format=json&limit=1&countrycodes=br";
            org.springframework.http.ResponseEntity<String> response = rt.exchange(url, HttpMethod.GET, entity, String.class);
            return Map.of("status", response.getStatusCode().toString(), "body", response.getBody());
        } catch (Exception e) {
            return Map.of("error", e.getMessage());
        }
    }

    @PostMapping("/cleanup-service-orders")
    public Map<String, Object> cleanupServiceOrders() {
        int deleted = jdbcTemplate.getJdbcTemplate().update(
                "DELETE FROM service_orders WHERE requested_by != 'PORTAL'"
        );
        int kept = jdbcTemplate.getJdbcTemplate().queryForObject(
                "SELECT COUNT(*) FROM service_orders WHERE requested_by = 'PORTAL'",
                Integer.class
        );
        return Map.of("deleted", deleted, "kept", kept);
    }

    @PostMapping("/fix-plate-nullable")
    public Map<String, Object> fixPlateNullable() {
        jdbcTemplate.getJdbcTemplate().execute(
                "ALTER TABLE service_orders ALTER COLUMN plate DROP NOT NULL"
        );
        return Map.of("status", "ok", "message", "Constraint NOT NULL removida da coluna plate em service_orders");
    }

    @GetMapping("/fix-user-roles")
    public Map<String, Object> fixUserRoles() {
        jdbcTemplate.getJdbcTemplate().execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check");
        jdbcTemplate.getJdbcTemplate().execute(
                "ALTER TABLE users ADD CONSTRAINT users_role_check " +
                "CHECK (role IN ('ADMIN', 'OPERATOR', 'FIELD', 'TECHNICIAN'))"
        );
        return Map.of("status", "ok", "message", "CHECK constraint users_role_check atualizada com FIELD e TECHNICIAN");
    }

    @GetMapping("/check-user-constraints")
    public Map<String, Object> checkUserConstraints() {
        List<Map<String, Object>> constraints = jdbcTemplate.getJdbcTemplate().queryForList(
                "SELECT conname, pg_get_constraintdef(oid) AS definition " +
                "FROM pg_constraint " +
                "WHERE conrelid = 'users'::regclass"
        );
        return Map.of("constraints", constraints);
    }

    @GetMapping("/check-installations")
    public Map<String, Object> checkInstallations() {

        List<Installation> all = installationRepository.findAllByOrderByCreatedAtDesc();

        Map<String, Long> byStatus = new LinkedHashMap<>();
        for (Installation inst : all) {
            String s = inst.getStatus() != null ? inst.getStatus().name() : "NULL";
            byStatus.merge(s, 1L, Long::sum);
        }

        List<Map<String, Object>> list = all.stream().map(inst -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", inst.getId());
            row.put("externalId", inst.getExternalId());
            row.put("plate", inst.getPlate());
            row.put("customerName", inst.getCustomerName());
            row.put("status", inst.getStatus());
            row.put("portalStatus", inst.getPortalStatus());
            row.put("portalCreatedAt", inst.getPortalCreatedAt());
            row.put("createdAt", inst.getCreatedAt());
            return row;
        }).toList();

        return Map.of(
                "total", all.size(),
                "byStatus", byStatus,
                "list", list
        );

    }

    @PostMapping("/migrate-installations")
    public Map<String, Object> migrateInstallations() {

        List<Installation> all = installationRepository.findAllByOrderByCreatedAtDesc();

        int created = 0;
        int skipped = 0;
        int noExternalId = 0;

        Map<String, Long> byStatus = new LinkedHashMap<>();
        for (Installation inst : all) {
            String s = inst.getStatus() != null ? inst.getStatus().name() : "NULL";
            byStatus.merge(s, 1L, Long::sum);
        }

        for (Installation inst : all) {
            if (inst.getExternalId() == null) { noExternalId++; continue; }
            var result = serviceOrderService.createFromInstallation(
                    inst.getExternalId(),
                    inst.getPlate(),
                    inst.getCustomerName(),
                    inst.getPhone(),
                    inst.getCity(),
                    inst.getAddress(),
                    inst.getNeighborhood(),
                    inst.getState(),
                    inst.getZipCode(),
                    inst.getPortalCreatedAt()
            );
            if (result != null) created++; else skipped++;
        }

        return Map.of(
                "totalInstallations", all.size(),
                "byStatus", byStatus,
                "ordersCreated", created,
                "alreadyExisted", skipped,
                "noExternalId", noExternalId
        );

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

    @GetMapping("/check-service-orders")
    public List<Map<String, Object>> checkServiceOrders() {
        return serviceOrderService.listAll(true).stream()
                .map(o -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("id",               o.id());
                    row.put("plate",            o.plate());
                    row.put("schedulingStatus", o.schedulingStatus());
                    row.put("technicianName",   o.technician() != null ? o.technician().name() : null);
                    row.put("scheduledDate",    o.scheduledDate());
                    row.put("scheduledTime",    o.scheduledTime());
                    row.put("serviceValue",     o.serviceValue());
                    row.put("createdAt",        o.createdAt());
                    return row;
                })
                .toList();
    }

    @GetMapping("/sync-tracknme")
    public Map<String, Object> syncTracknMe() {
        tracknMeSyncService.syncDevices();
        tracknMeSyncService.syncPositions();
        return Map.of("status", "ok", "message", "Sync TracknMe concluído (dispositivos + posições)");
    }

    // Diagnostico temporario — confirmar que syncPositions() esta
    // preenchendo lastCommunicationAt de verdade apos o fix de
    // fetchPositions()/parseDateTime().
    @GetMapping("/check-tracknme")
    public List<Map<String, Object>> checkTracknMe() {

        return vehicleRepository.findAll().stream()
                .filter(v -> v.getVehicleGroup() == VehicleGroup.TRACKNME && v.getDeletedAt() == null)
                .map(v -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("plate", v.getPlate());
                    row.put("tracknmeDeviceId", v.getTracknmeDeviceId());
                    row.put("tracknmeModel", v.getTracknmeModel());
                    row.put("tracknmeImei", v.getTracknmeImei());
                    operationalSnapshotRepository.findFirstByVehicle(v).ifPresentOrElse(
                            snapshot -> {
                                row.put("lastCommunicationAt", snapshot.getLastCommunicationAt());
                                row.put("online", snapshot.getOnline());
                            },
                            () -> row.put("snapshot", "nenhum")
                    );
                    return row;
                })
                .toList();

    }

    // Corrige linhas antigas da tabela etl_status gravadas antes do rename
    // de ImportType.I4PRO_TRACKNME para I4PRO — sem isso, o Hibernate
    // falha ao desserializar essas linhas (@Enumerated(EnumType.STRING)
    // em EtlStatus.java) e derruba GET /etl/status inteiro.
    @GetMapping("/fix-i4pro-type")
    public Map<String, Object> fixI4proType() {
        int updated = jdbcTemplate.getJdbcTemplate().update(
            "UPDATE etl_status SET type = 'I4PRO' WHERE type = 'I4PRO_TRACKNME'"
        );
        return Map.of("status", "ok", "updated", updated);
    }

    @GetMapping("/ajuste-banco")
    public Map<String, Object> corrigirEtl() {
        jdbcTemplate.getJdbcTemplate().execute(
            "ALTER TABLE etl_status DROP CONSTRAINT IF EXISTS etl_status_type_check"
        );
        jdbcTemplate.getJdbcTemplate().execute(
            "ALTER TABLE etl_status ADD CONSTRAINT etl_status_type_check " +
            "CHECK (type IN ('MULTIPORTAL_DEVICE','MULTIPORTAL_LINKAGE','MULTIPORTAL_OPERATIONAL'," +
            "'MULTIPORTAL_ULTIMA_POSICAO','INSTALLATION_SYNC','OPERATIONAL_ENGINE'," +
            "'SERVICE_ORDER_COMPLETION','TRACKNME','TRACKNME_POSITION','I4PRO'))"
        );
        return Map.of("status", "ok", "message", "Constraint etl_status_type_check recriada com todos os tipos validos");
    }

    @GetMapping("/fix-scheduling-status")
    public Map<String, Object> fixSchedulingStatus() {
        int updated = jdbcTemplate.getJdbcTemplate().update(
            "UPDATE service_orders SET scheduling_status = 'AGENDADO' " +
            "WHERE technician_id IS NOT NULL AND scheduled_date IS NOT NULL " +
            "AND scheduling_status = 'ABERTO'"
        );
        return Map.of("status", "ok", "updated", updated);
    }

    // Diagnostico puro: sem validacao de chave, sem chamar
    // etlStatusService, so ecoa de volta o que recebeu. Se isso tambem
    // vier 403, isola de vez que o problema nao esta em nada que
    // etlHeartbeat() faz por dentro — e sim em algo ligado ao path/deploy.
    @GetMapping("/heartbeat-test")
    public Map<String, Object> heartbeatTest(
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String tk
    ) {
        return Map.of("status", "OK", "type", type != null ? type : "none");
    }

    // Sem validacao de chave — protegido so pelo permitAll() de
    // /setup/**. Endpoint fica aberto pra qualquer requisicao que
    // souber o path (sem segredo nenhum envolvido).
    @GetMapping("/etl-heartbeat")
    public Map<String, Object> etlHeartbeat(
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long durationMs,
            @RequestParam(required = false) String error,
            @RequestParam(required = false) Integer recordsProcessed,
            @RequestParam(required = false) String nextRunAt
    ) {

        try {
            etlStatusService.heartbeat(
                    new EtlHeartbeatRequest(
                            type != null ? ImportType.valueOf(type) : null,
                            status != null ? EtlRunStatus.valueOf(status) : null,
                            durationMs,
                            error,
                            recordsProcessed,
                            parseNextRunAt(nextRunAt)
                    )
            );
            return Map.of("status", "OK");
        } catch (Exception e) {
            log.error("[HEARTBEAT] Erro: {}", e.getMessage(), e);
            return Map.of("status", "ERROR", "message", e.getMessage());
        }

    }

    // scheduler.js manda nextRunAt via new Date().toISOString().
    private LocalDateTime parseNextRunAt(String raw) {

        if (raw == null || raw.isBlank()) {
            return null;
        }

        try {
            return OffsetDateTime.parse(raw).toLocalDateTime();
        } catch (DateTimeParseException e) {
            try {
                return LocalDateTime.parse(raw);
            } catch (DateTimeParseException e2) {
                log.warn("[SETUP] nextRunAt em formato invalido, ignorando: {}", raw);
                return null;
            }
        }

    }

}
