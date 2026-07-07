package com.fusion.fusion.installation;

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
@RequestMapping("/installations")
@RequiredArgsConstructor
public class InstallationController {

    private final InstallationService service;

    @Value("${fusion.etl.api-key:}")
    private String etlApiKey;

    @GetMapping
    public List<InstallationResponse> findAll(
            @RequestParam(required = false) String status
    ) {
        return service.findAll(status);
    }

    @GetMapping("/pending-count")
    public Map<String, Long> pendingCount() {
        return Map.of("count", service.countPending());
    }

    @PutMapping("/{id}/sent")
    public InstallationResponse markSent(@PathVariable Long id) {
        return service.markSent(id);
    }

    @PutMapping("/{id}/cancel")
    public InstallationResponse cancel(@PathVariable Long id) {
        return service.cancel(id);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }

    @PostMapping("/sync")
    public ResponseEntity<?> sync(
            @RequestHeader(value = "X-ETL-Key", required = false) String providedKey,
            @RequestBody List<InstallationRequest> items
    ) {
        if (etlApiKey == null || etlApiKey.isBlank() || !etlApiKey.equals(providedKey)) {
            log.warn("POST /installations/sync rejeitado: X-ETL-Key inválida ou ausente");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Chave de API inválida"));
        }

        return ResponseEntity.ok(service.sync(items));
    }

}
