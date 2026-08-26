package com.fusion.fusion.etl;

import com.fusion.fusion.importation.ImportType;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

// Heartbeat do ETL local — uma linha por tipo de scraper. O ETL
// reporta antes (RUNNING) e depois (SUCCESS/ERROR) de cada execucao,
// seja ela disparada pelo cron local ou pelo poll() do trigger.
@Entity
@Table(name = "etl_status")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EtlStatus {

    @Id
    @Enumerated(EnumType.STRING)
    private ImportType type;

    @Enumerated(EnumType.STRING)
    private EtlRunStatus status;

    private LocalDateTime lastRunAt;

    private Long lastDurationMs;

    @Column(columnDefinition = "TEXT")
    private String lastError;

    private Integer lastRecordsProcessed;

    // Etapa atual reportada pelo ETL enquanto status=RUNNING (ex:
    // "Aguardando download da planilha") — so' atualizado quando o
    // heartbeat vem com um valor de verdade, ver EtlStatusService
    // .heartbeat(); assim um heartbeat "de wrapper" sem step (o
    // RUNNING/SUCCESS que triggerPoller.js/scheduler.js ja mandavam
    // antes desta mudanca) nao apaga a etapa mais granular que o
    // proprio script acabou de reportar.
    private String currentStep;

    // Historico das etapas ja reportadas na execucao RUNNING atual, na
    // ordem em que chegaram — o polling do frontend e' de 2s, mais
    // lento que o ritmo com que o ETL reporta steps, entao so' mostrar
    // o currentStep faz etapas intermediarias "sumirem" entre um poll
    // e outro. Limpo no inicio de cada nova execucao (ver
    // EtlStatusService.heartbeat()), nao a cada heartbeat RUNNING.
    @ElementCollection
    @CollectionTable(name = "etl_status_steps_history", joinColumns = @JoinColumn(name = "etl_status_type"))
    @OrderColumn(name = "step_order")
    @Column(name = "step", columnDefinition = "TEXT")
    @Builder.Default
    private List<String> stepsHistory = new ArrayList<>();

    private LocalDateTime nextRunAt;

    private LocalDateTime updatedAt;

    public void addStep(String step) {

        if (stepsHistory == null) {
            stepsHistory = new ArrayList<>();
        }

        // Evita duplicar a mesma etapa em sequencia caso o heartbeat
        // seja reenviado (retry de rede, por exemplo).
        if (stepsHistory.isEmpty() || !stepsHistory.get(stepsHistory.size() - 1).equals(step)) {
            stepsHistory.add(step);
        }

    }

}
