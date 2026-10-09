package com.fusion.fusion.config;

import com.fusion.fusion.installation.InstallationStatus;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.stream.Collectors;

// Hibernate 6 cria a CHECK de enum (installations_status_check) so' na
// criacao da tabela — ddl-auto=update nao atualiza a lista quando entra
// valor novo no enum (ex.: ARCHIVED), e o UPDATE falharia com violacao
// de constraint. Recria a partir do proprio enum a cada startup, entao
// nao precisa manter lista duplicada aqui (mesmo padrao de
// EtlStatusConstraintMigration).
@Slf4j
@Component
public class InstallationStatusConstraintMigration {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @PostConstruct
    public void migrateConstraint() {
        try {
            String values = Arrays.stream(InstallationStatus.values())
                    .map(s -> "'" + s.name() + "'")
                    .collect(Collectors.joining(","));
            jdbcTemplate.execute("ALTER TABLE installations DROP CONSTRAINT IF EXISTS installations_status_check");
            jdbcTemplate.execute("ALTER TABLE installations ADD CONSTRAINT installations_status_check CHECK (status IN (" + values + "))");
            log.info("[MIGRATION] installations status constraint atualizada com sucesso");
        } catch (Exception e) {
            log.warn("[MIGRATION] installations status constraint falhou: {}", e.getMessage());
        }
    }
}
