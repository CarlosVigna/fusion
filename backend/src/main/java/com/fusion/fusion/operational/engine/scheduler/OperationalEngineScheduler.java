package com.fusion.fusion.operational.scheduler;

import com.fusion.fusion.operational.engine
        .OperationalStateEngineService;

import lombok.RequiredArgsConstructor;

import lombok.extern.slf4j.Slf4j;

import org.springframework.scheduling.annotation.Scheduled;

import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class OperationalEngineScheduler {

    private final OperationalStateEngineService
            engineService;

    @Scheduled(fixedDelay = 300000)
    public void execute() {

        log.info(
                "Executando engine operacional..."
        );

        engineService.processAll();

    }

}