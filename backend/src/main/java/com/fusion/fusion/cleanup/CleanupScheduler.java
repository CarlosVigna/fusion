package com.fusion.fusion.cleanup;

import com.fusion.fusion.alert.OperationalAlertRepository;
import com.fusion.fusion.alert.OperationalAlertStatus;
import com.fusion.fusion.audit.AuditLogRepository;
import com.fusion.fusion.importation.ImportDiffLogRepository;
import com.fusion.fusion.importation.ImportHistoryRepository;
import com.fusion.fusion.signalcontrol.SignalReturnAlertRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneOffset;

// Limpeza periodica de tabelas de historico que so crescem — evita
// inchar o Neon indefinidamente. Deliberadamente NAO apaga nada que
// ainda esteja "em aberto": alerta OPEN, SignalReturnAlert/ImportDiffLog
// ainda nao dismissado. So a idade sozinha nunca remove algo que o
// operador ainda pode precisar ver/agir — so remove o que ja foi
// resolvido/visto e ficou velho.
@Slf4j
@Component
@RequiredArgsConstructor
public class CleanupScheduler {

    private final OperationalAlertRepository operationalAlertRepository;
    private final SignalReturnAlertRepository signalReturnAlertRepository;
    private final ImportDiffLogRepository importDiffLogRepository;
    private final ImportHistoryRepository importHistoryRepository;
    private final AuditLogRepository auditLogRepository;

    @Scheduled(cron = "0 0 3 * * SUN")
    @Transactional
    public void cleanOldRecords() {

        LocalDateTime cutoff7  = LocalDateTime.now(ZoneOffset.UTC).minusDays(7);
        LocalDateTime cutoff30 = LocalDateTime.now(ZoneOffset.UTC).minusDays(30);
        LocalDateTime cutoff60 = LocalDateTime.now(ZoneOffset.UTC).minusDays(60);
        LocalDateTime cutoff90 = LocalDateTime.now(ZoneOffset.UTC).minusDays(90);

        // 7 dias — so alertas ja RESOLVED (um OPEN vencido ha' meses
        // continua visivel ate' ser resolvido de verdade).
        long alertsDeleted = operationalAlertRepository
                .deleteByStatusAndOpenedAtBefore(OperationalAlertStatus.RESOLVED, cutoff7);

        // 30 dias — so alertas de retorno de sinal ja dismissados e diffs
        // de import ja vistos no sino.
        long signalReturnDeleted = signalReturnAlertRepository
                .deleteByDismissedTrueAndDetectedAtBefore(cutoff30);

        long diffLogDeleted = importDiffLogRepository
                .deleteByDismissedTrueAndCreatedAtBefore(cutoff30);

        // 60 dias — historico de import (sem estado "pendente" a preservar).
        long importHistoryDeleted = importHistoryRepository
                .deleteByCreatedAtBefore(cutoff60);

        // 90 dias — trilha de auditoria pura.
        long auditLogDeleted = auditLogRepository
                .deleteByCreatedAtBefore(cutoff90);

        log.info(
                "[CLEANUP] Limpeza periódica concluída — alertas={} signalReturn={} diffLog={} importHistory={} auditLog={}",
                alertsDeleted, signalReturnDeleted, diffLogDeleted, importHistoryDeleted, auditLogDeleted
        );

    }

}
