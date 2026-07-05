package com.fusion.fusion.etl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/etl")
@RequiredArgsConstructor
public class EtlStatusController {

    private final EtlStatusService statusService;

    @Value("${fusion.etl.api-key:}")
    private String etlApiKey;

    @PostMapping("/status")
    public ResponseEntity<?> reportStatus(
            @RequestBody EtlStatusDto dto,
            @RequestHeader(value = "X-ETL-Key", required = false) String providedKey
    ) {

        if (!isValidKey(providedKey)) {
            log.warn("Chamada ao /etl/status rejeitada: X-ETL-Key inválida ou ausente");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("status", "ERROR", "message", "Chave de API inválida"));
        }

        statusService.heartbeat(new EtlHeartbeatRequest(
                dto.type(),
                dto.status(),
                dto.durationMs(),
                dto.error(),
                dto.recordsProcessed(),
                dto.nextRunAt()
        ));

        return ResponseEntity.ok().build();

    }

    private boolean isValidKey(String providedKey) {
        return etlApiKey != null
                && !etlApiKey.isBlank()
                && etlApiKey.equals(providedKey);
    }

}
