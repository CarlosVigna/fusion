package com.fusion.fusion.etl;

import com.fusion.fusion.importation.ImportType;
import com.fusion.fusion.sinistro.SinistroAnalysisService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/etl")
@RequiredArgsConstructor
public class EtlController {

    private final EtlTriggerService triggerService;

    private final EtlStatusService statusService;

    private final SinistroAnalysisService sinistroAnalysisService;

    @Value("${fusion.etl.api-key:}")
    private String etlApiKey;

    // O ETL local chama isso periodicamente perguntando se ha um
    // scrape pendente — substitui o backend tentar chamar o ETL
    // direto (impossivel sem tunel, o ETL esta atras de NAT).
    @GetMapping("/poll")
    public ResponseEntity<?> poll(
            @RequestHeader(value = "X-ETL-Key", required = false) String providedKey
    ) {

        if (!isValidKey(providedKey)) {
            return unauthorized();
        }

        var trigger = triggerService.poll();
        return ResponseEntity.ok(
                new EtlPollResponse(
                        trigger.map(EtlTriggerService.EtlTriggerPayload::type).orElse(null),
                        trigger.map(EtlTriggerService.EtlTriggerPayload::plate).orElse(null),
                        sinistroAnalysisService.claimNextPending().orElse(null)
                )
        );

    }

    // Trocado de POST para GET — payload vai via query params em vez de
    // body. Motivo: POST /etl/heartbeat estava voltando 403 puro (sem
    // corpo, so' os headers padrao do Spring Security) mesmo com a
    // permitAll() e a chave corretas, enquanto GET /etl/poll (mesma
    // permitAll(), mesma chave) sempre funcionou — unica diferenca
    // observavel entre os dois era o metodo HTTP.
    @GetMapping("/heartbeat")
    public ResponseEntity<?> heartbeat(
            @RequestParam ImportType type,
            @RequestParam EtlRunStatus status,
            @RequestParam(required = false) Long durationMs,
            @RequestParam(required = false) String error,
            @RequestParam(required = false) Integer recordsProcessed,
            @RequestParam(required = false) String nextRunAt,
            @RequestParam(required = false) String step,
            @RequestHeader(value = "X-ETL-Key", required = false) String providedKey
    ) {

        // Diagnostico do 403 em /etl/heartbeat: se essas duas linhas nunca
        // aparecerem no log, a requisicao esta sendo barrada antes de
        // chegar aqui (SecurityConfig/filtro), nao pela validacao de
        // chave abaixo — foi exatamente isso que confirmamos rodando
        // contra producao (403 puro, sem o corpo JSON que unauthorized()
        // devolve, com os headers padrao do Spring Security).
        log.info("[HEARTBEAT] Header recebido: {}", providedKey);
        log.info("[HEARTBEAT] Header esperado: {}...", etlApiKey.length() > 12 ? etlApiKey.substring(0, 12) : etlApiKey);
        log.info("[HEARTBEAT] Chaves batem: {}", etlApiKey.trim().equals(providedKey != null ? providedKey.trim() : ""));
        log.info("[HEARTBEAT] Tamanho esperado: {}, recebido: {}", etlApiKey.length(), providedKey != null ? providedKey.length() : 0);

        if (!isValidKey(providedKey)) {
            return unauthorized();
        }

        statusService.heartbeat(
                new EtlHeartbeatRequest(
                        type,
                        status,
                        durationMs,
                        error,
                        recordsProcessed,
                        parseNextRunAt(nextRunAt),
                        step
                )
        );

        return ResponseEntity.ok().build();

    }

    // scheduler.js manda nextRunAt via new Date().toISOString() (formato
    // com offset/instant, ex: "2026-08-13T05:00:00.000Z") — mesmo parsing
    // tolerante ja usado em TracknMeSyncService para o mesmo tipo de data.
    private LocalDateTime parseNextRunAt(String raw) {

        if (raw == null || raw.isBlank()) {
            return null;
        }

        try {
            return OffsetDateTime.parse(raw).toLocalDateTime();
        } catch (DateTimeParseException e) {
            try {
                return LocalDateTime.parse(raw);
            } catch (DateTimeParseException e2) {
                log.warn("[HEARTBEAT] nextRunAt em formato invalido, ignorando: {}", raw);
                return null;
            }
        }

    }

    // Lido pela tela de monitoramento do ETL no Fusion — autenticado
    // por JWT normal (cai em anyRequest().authenticated()), nao por
    // X-ETL-Key.
    @GetMapping("/status")
    public List<EtlStatusResponse> status() {

        return statusService.findAll();

    }

    private boolean isValidKey(String providedKey) {

        // .trim() nos dois lados — defensivo contra espaco/quebra de
        // linha invisivel vindo da UI do Railway ou de um .env local
        // (nao e' a causa confirmada do 403 atual: testamos com a chave
        // certa e o request nem chega aqui, ver comentario no metodo
        // heartbeat() — mas elimina essa classe de bug de qualquer jeito).
        if (etlApiKey == null || providedKey == null) {
            return false;
        }

        String expected = etlApiKey.trim();
        String provided = providedKey.trim();

        return !expected.isBlank() && expected.equals(provided);

    }

    private ResponseEntity<?> unauthorized() {

        log.warn("Chamada ao /etl rejeitada: X-ETL-Key inválida ou ausente");

        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of(
                        "status", "ERROR",
                        "message", "Chave de API inválida"
                ));

    }

}
