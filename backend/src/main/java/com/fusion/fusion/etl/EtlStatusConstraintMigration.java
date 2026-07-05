package com.fusion.fusion.etl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;

// Hibernate com ddl-auto=update nao regenera CHECK constraints quando
// novos valores sao adicionados ao enum. Esta classe corrige a constraint
// etl_status_type_check toda vez que o app sobe (idempotente).
@Slf4j
@Component
@RequiredArgsConstructor
public class EtlStatusConstraintMigration implements ApplicationRunner {

    private final DataSource dataSource;

    @Override
    public void run(ApplicationArguments args) {
        try (Connection conn = dataSource.getConnection()) {
            conn.prepareStatement(
                "ALTER TABLE etl_status DROP CONSTRAINT IF EXISTS etl_status_type_check"
            ).execute();
            conn.prepareStatement(
                "ALTER TABLE etl_status ADD CONSTRAINT etl_status_type_check " +
                "CHECK (type IN ('TRACKNME','MULTIPORTAL_DEVICE','MULTIPORTAL_LINKAGE'," +
                "'MULTIPORTAL_OPERATIONAL','MULTIPORTAL_ULTIMA_POSICAO'))"
            ).execute();
            log.info("[MIGRATION] etl_status_type_check atualizada");
        } catch (Exception e) {
            log.warn("[MIGRATION] Falha ao atualizar etl_status_type_check: {}", e.getMessage());
        }
    }

}
