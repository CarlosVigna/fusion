package com.fusion.fusion.operational.engine;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class EngineAsyncService {

    private final OperationalStateEngineService engineService;

    // Roda em thread do pool de @Async — contexto transacional completamente
    // novo, sem herdar nenhum resíduo da transação do importFile(). O sleep
    // de 500ms é uma margem de segurança para garantir que o commit do import
    // já foi confirmado pelo banco antes de o motor ler os estados.
    @Async
    public void runAfterImport() {

        try {

            Thread.sleep(500);

            log.info("[MOTOR] Iniciando processAll() assíncrono pós-import");

            engineService.processAll();

            log.info("[MOTOR] processAll() assíncrono concluído");

        } catch (Exception e) {

            log.warn("[MOTOR] Falha assíncrona: {}", e.getMessage(), e);

        }

    }

}
