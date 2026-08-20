package com.fusion.fusion.maintenance;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

// So loga e alimenta o badge da UI (GET /maintenance/overdue, ja
// existente) — sem notificacao via WhatsApp por enquanto, ver
// MaintenanceRecordService.findOverdue() pro criterio de "vencido"
// (status ABERTO + prazoEncerramento <= hoje).
@Slf4j
@Component
@RequiredArgsConstructor
public class MaintenanceScheduler {

    private final MaintenanceRecordService service;

    @Scheduled(cron = "0 0 * * * *")
    public void checkOverdue() {

        List<MaintenanceRecordResponse> overdue = service.findOverdue();

        log.info("[MAINTENANCE] {} manutenções com prazo vencido", overdue.size());

    }

}
