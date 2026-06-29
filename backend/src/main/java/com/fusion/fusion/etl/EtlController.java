package com.fusion.fusion.etl;

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

        return ResponseEntity.ok(
                new EtlPollResponse(
                        triggerService.poll().orElse(null)
                )
        );

    }

    @PostMapping("/heartbeat")
    public ResponseEntity<?> heartbeat(
            @RequestBody EtlHeartbeatRequest request,
            @RequestHeader(value = "X-ETL-Key", required = false) String providedKey
    ) {

        if (!isValidKey(providedKey)) {
            return unauthorized();
        }

        statusService.heartbeat(request);

        return ResponseEntity.ok().build();

    }

    // Lido pela tela de monitoramento do ETL no Fusion — autenticado
    // por JWT normal (cai em anyRequest().authenticated()), nao por
    // X-ETL-Key.
    @GetMapping("/status")
    public List<EtlStatusResponse> status() {

        return statusService.findAll();

    }

    private boolean isValidKey(String providedKey) {

        return etlApiKey != null
                && !etlApiKey.isBlank()
                && etlApiKey.equals(providedKey);

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
