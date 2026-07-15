package com.fusion.fusion.setup;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/setup")
@RequiredArgsConstructor
public class SetupController {

    private final NamedParameterJdbcTemplate jdbcTemplate;

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

}
