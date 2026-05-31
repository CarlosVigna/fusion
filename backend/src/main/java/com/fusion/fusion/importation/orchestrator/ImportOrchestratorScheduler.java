package com.fusion.fusion.importation.orchestrator;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class ImportOrchestratorScheduler {

    private final ImportOrchestratorService
            orchestratorService;

    @Scheduled(fixedDelay = 30000)
    public void execute() {

        log.info(
                "Executando orchestrator de importação..."
        );

        orchestratorService.execute();

    }

}