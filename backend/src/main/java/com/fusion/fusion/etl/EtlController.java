package com.fusion.fusion.etl;

import com.fusion.fusion.sinistro.SinistroAnalysisService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

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

    @PostMapping("/heartbeat")
    public ResponseEntity<?> heartbeat(
            @RequestBody EtlHeartbeatRequest request,
            @RequestHeader(value = "X-ETL-Key", required = false) String providedKey
    ) {

        // Diagnostico do 403 em /etl/heartbeat: se essas duas linhas nunca
        // aparecerem no log, a requisicao esta sendo barrada antes de
        // chegar aqui (SecurityConfig/filtro), nao pela validacao de
        // chave abaixo — foi exatamente isso que confirmamos rodando
        // contra producao (403 puro, sem o corpo JSON que unauthorized()
        // devolve, com os headers padrao do Spring Security).
        log.info("[HEARTBEAT] Header recebido: {}", providedKey);
        log.info("[HEARTBEAT] Header esperado: {}", maskKey(etlApiKey));

        if (!isValidKey(providedKey)) {
            return unauthorized();
        }

        statusService.heartbeat(request);

        return ResponseEntity.ok().build();

    }

    private String maskKey(String key) {
        if (key == null || key.isBlank()) return "(vazia/nao configurada)";
        return key.substring(0, Math.min(8, key.length())) + "...";
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
