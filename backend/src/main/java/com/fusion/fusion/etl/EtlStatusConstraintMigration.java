package com.fusion.fusion.etl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.Statement;

// Hibernate com ddl-auto=update nao regenera CHECK constraints quando
// novos valores sao adicionados a um enum. Esta classe corrige as constraints
// de todas as tabelas afetadas toda vez que o app sobe (idempotente).
@Slf4j
@Component
@RequiredArgsConstructor
public class EtlStatusConstraintMigration implements ApplicationRunner {

    private final DataSource dataSource;

    @Override
    public void run(ApplicationArguments args) {
        try (Connection conn = dataSource.getConnection();
             Statement st = conn.createStatement()) {

            // etl_status.type (ImportType — 6 valores, inclui INSTALACOES)
            st.execute("ALTER TABLE etl_status DROP CONSTRAINT IF EXISTS etl_status_type_check");
            st.execute(
                "ALTER TABLE etl_status ADD CONSTRAINT etl_status_type_check " +
                "CHECK (type IN ('TRACKNME','MULTIPORTAL_DEVICE','MULTIPORTAL_LINKAGE'," +
                "'MULTIPORTAL_OPERATIONAL','MULTIPORTAL_ULTIMA_POSICAO','INSTALACOES'))"
            );

            // import_history.type (mesma enum ImportType)
            st.execute("ALTER TABLE import_history DROP CONSTRAINT IF EXISTS import_history_type_check");
            st.execute(
                "ALTER TABLE import_history ADD CONSTRAINT import_history_type_check " +
                "CHECK (type IN ('TRACKNME','MULTIPORTAL_DEVICE','MULTIPORTAL_LINKAGE'," +
                "'MULTIPORTAL_OPERATIONAL','MULTIPORTAL_ULTIMA_POSICAO','INSTALACOES'))"
            );

            // timeline_event.type (TimelineEventType — 11 valores; LOW_BATTERY_DETECTED
            // e STALE_UPDATE_DETECTED foram adicionados depois da criacao da tabela)
            st.execute("ALTER TABLE timeline_event DROP CONSTRAINT IF EXISTS timeline_event_type_check");
            st.execute(
                "ALTER TABLE timeline_event ADD CONSTRAINT timeline_event_type_check " +
                "CHECK (type IN ('ALERT_OPENED','ALERT_RESOLVED','OCCURRENCE_CREATED'," +
                "'OCCURRENCE_UPDATED','STATUS_CHANGED','COMMENT_ADDED','COMMUNICATION_ONLINE'," +
                "'COMMUNICATION_DELAYED','COMMUNICATION_LOST','LOW_BATTERY_DETECTED'," +
                "'STALE_UPDATE_DETECTED'))"
            );

            // maintenance_records.status (BAIXADA adicionado ao enum)
            st.execute("ALTER TABLE maintenance_records DROP CONSTRAINT IF EXISTS maintenance_records_status_check");
            st.execute(
                "ALTER TABLE maintenance_records ADD CONSTRAINT maintenance_records_status_check " +
                "CHECK (status IN ('ABERTO','ENCERRADO','BAIXADA'))"
            );

            // letter_records.status — coluna adicionada ao modelo; registros
            // pre-existentes ficam com NULL e precisam ser inicializados.
            st.execute(
                "UPDATE letter_records SET status = 'ATIVA' WHERE status IS NULL"
            );

            // vehicles.vehicle_group — marca as 6 placas do grupo KAKO.
            // Idempotente: UPDATE em placas que ja tem KAKO nao muda nada.
            st.execute(
                "UPDATE vehicles SET vehicle_group = 'KAKO' " +
                "WHERE plate IN ('DKU9B11','EYQ5993','FWQ6628','SWI4I26','GCZ5B67','QCV2E16')"
            );

            log.info("[MIGRATION] CHECK constraints atualizadas: etl_status, import_history, " +
                     "timeline_event, maintenance_records; letter_records inicializado; " +
                     "vehicles KAKO marcados");

        } catch (Exception e) {
            log.warn("[MIGRATION] Falha ao atualizar CHECK constraints: {}", e.getMessage());
        }
    }

}
