package com.fusion.fusion.config;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class EtlStatusConstraintMigration {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @PostConstruct
    public void migrateConstraint() {
        try {
            // DELETE tinha a mesma lista da constraint, sem 'INSTALACOES' —
            // isso apagava toda linha de heartbeat de instalacoes a cada
            // reinicio do backend (todo deploy), antes mesmo de a
            // constraint ser recriada. As duas listas precisam ficar
            // sincronizadas, senao o proximo deploy volta a apagar tudo.
            jdbcTemplate.execute("DELETE FROM etl_status WHERE type NOT IN ('MULTIPORTAL_DEVICE','MULTIPORTAL_LINKAGE','MULTIPORTAL_OPERATIONAL','MULTIPORTAL_ULTIMA_POSICAO','INSTALLATION_SYNC','OPERATIONAL_ENGINE','SERVICE_ORDER_COMPLETION','TRACKNME','TRACKNME_POSITION','I4PRO','INSTALACOES')");
            jdbcTemplate.execute("ALTER TABLE etl_status DROP CONSTRAINT IF EXISTS etl_status_type_check");
            jdbcTemplate.execute("ALTER TABLE etl_status ADD CONSTRAINT etl_status_type_check CHECK (type IN ('MULTIPORTAL_DEVICE','MULTIPORTAL_LINKAGE','MULTIPORTAL_OPERATIONAL','MULTIPORTAL_ULTIMA_POSICAO','INSTALLATION_SYNC','OPERATIONAL_ENGINE','SERVICE_ORDER_COMPLETION','TRACKNME','TRACKNME_POSITION','I4PRO','INSTALACOES'))");
            log.info("[MIGRATION] etl_status constraint atualizada com sucesso");
        } catch (Exception e) {
            log.warn("[MIGRATION] etl_status constraint falhou: {}", e.getMessage());
        }
    }
}
