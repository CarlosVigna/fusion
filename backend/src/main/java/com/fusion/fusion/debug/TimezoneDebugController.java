package com.fusion.fusion.debug;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.TimeZone;

@RestController
@RequiredArgsConstructor
public class TimezoneDebugController {

    private final DataSource dataSource;

    @GetMapping("/debug/timezone")
    public Map<String, String> timezone() {

        Map<String, String> info = new LinkedHashMap<>();

        info.put(
                "systemDefaultZone",
                TimeZone.getDefault().getID()
        );

        info.put(
                "userTimezone",
                System.getProperty("user.timezone")
        );

        info.put(
                "TZ_env",
                System.getenv("TZ")
        );

        info.put(
                "JAVA_TOOL_OPTIONS",
                System.getenv("JAVA_TOOL_OPTIONS")
        );

        info.put(
                "now_java",
                LocalDateTime.now().toString()
        );

        info.put(
                "now_utc",
                LocalDateTime.now(ZoneOffset.UTC).toString()
        );

        info.put(
                "instant_now",
                Instant.now().toString()
        );

        // Query nativa usando o MESMO pool de conexao (HikariCP) que o
        // Hibernate usa para gravar vehicle_operational_state/
        // operational_snapshot — para descobrir se essa conexao
        // especifica enxerga um timezone de sessao diferente de uma
        // conexao externa qualquer.
        try (
                Connection connection = dataSource.getConnection();
                Statement statement = connection.createStatement();
                ResultSet resultSet = statement.executeQuery(
                        "SELECT now(), current_setting('TimeZone')"
                )
        ) {

            if (resultSet.next()) {

                info.put(
                        "jdbcPool_pgNow",
                        resultSet.getString(1)
                );

                info.put(
                        "jdbcPool_pgTimezoneSetting",
                        resultSet.getString(2)
                );

            }

            info.put(
                    "jdbcPool_connectionClass",
                    connection.getClass().getName()
            );

        } catch (Exception e) {

            info.put(
                    "jdbcPool_error",
                    e.toString()
            );

        }

        return info;

    }

}
