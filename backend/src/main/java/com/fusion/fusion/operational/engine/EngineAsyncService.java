package com.fusion.fusion.operational.engine;

import com.fusion.fusion.realtime.DashboardRealtimeService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class EngineAsyncService {

    private final OperationalStateEngineService engineService;

    private final DashboardRealtimeService realtimeService;

    @Async
    public void runAfterImport() {

        try {

            Thread.sleep(500);

            log.info("[MOTOR] Iniciando processAll() assíncrono pós-import");

            engineService.processAll();

            log.info("[MOTOR] processAll() assíncrono concluído");

            realtimeService.publish(
                    "GRID_UPDATED",
                    "Motor operacional concluído"
            );

        } catch (Exception e) {

            log.warn("[MOTOR] Falha assíncrona: {}", e.getMessage(), e);

        }

    }

}
