package com.fusion.fusion.etl;

import com.fusion.fusion.importation.ImportType;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

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

    private LocalDateTime nextRunAt;

    private LocalDateTime updatedAt;

}
