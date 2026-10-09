package com.fusion.fusion.installation;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.LinkedHashMap;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/installations")
@RequiredArgsConstructor
public class InstallationController {

    private final InstallationService service;

    private final InstallationSyncService syncService;

    @Value("${fusion.etl.api-key:}")
    private String etlApiKey;

    @GetMapping
    public List<InstallationResponse> findAll(
            @RequestParam(required = false) String status
    ) {
        return service.findAll(status);
    }

    // Criacao manual — usuario logado no navegador (JWT), diferente de
    // POST /sync abaixo (lote, X-ETL-Key, exclusivo do ETL local).
    @PostMapping
    public InstallationResponse create(@RequestBody InstallationRequest request) {
        return service.create(request);
    }

    @GetMapping("/pending-count")
    public Map<String, Long> pendingCount() {
        Map<String, Long> result = new LinkedHashMap<>();
        result.put("count", service.countPending());
        result.put("critical", service.countCritical());
        return result;
    }

    @GetMapping("/dashboard")
    public Map<String, Object> dashboard() {
        return service.getDashboard();
    }

    @PostMapping("/{id}/observations")
    public InstallationObservationResponse addObservation(
            @PathVariable Long id,
            @RequestBody Map<String, String> body
    ) {
        return service.addObservation(id, body.get("text"));
    }

    @GetMapping("/{id}/observations")
    public List<InstallationObservationResponse> getObservations(@PathVariable Long id) {
        return service.getObservations(id);
    }

    @PostMapping("/{id}/dismiss-alert")
    public InstallationResponse dismissAlert(@PathVariable Long id) {
        return service.dismissAlert(id);
    }

    @PutMapping("/{id}/sent")
    public InstallationResponse markSent(@PathVariable Long id) {
        return service.markSent(id);
    }

    @PutMapping("/{id}/cancel")
    public InstallationResponse cancel(@PathVariable Long id) {
        return service.cancel(id);
    }

    @PostMapping("/{id}/approve-payment")
    public InstallationResponse approvePayment(@PathVariable Long id) {
        return service.approvePayment(id);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }

    // date = dia no fuso de Sao Paulo; convertido pra UTC porque createdAt
    // e' gravado em UTC (ex.: 2026-09-01 -> 2026-09-01T03:00 UTC).
    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/archive-before")
    public Map<String, Integer> archiveBefore(@RequestParam LocalDate date) {
        LocalDateTime cutoff = date.atStartOfDay(ZoneId.of("America/Sao_Paulo"))
                .withZoneSameInstant(ZoneOffset.UTC)
                .toLocalDateTime();
        return Map.of("archived", service.archiveOlderThan(cutoff));
    }

    // ─── Fase 2: endpoints para ETL (X-ETL-Key) ─────────────────────────────

    @GetMapping("/by-plate")
    public ResponseEntity<Installation> getByPlate(
            @RequestHeader(value = "X-ETL-Key", required = false) String providedKey,
            @RequestParam String plate) {
        if (etlApiKey == null || etlApiKey.isBlank() || !etlApiKey.equals(providedKey)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return service.findByPlate(plate)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}/financial-approval")
    public ResponseEntity<?> financialApproval(
            @RequestHeader(value = "X-ETL-Key", required = false) String providedKey,
            @PathVariable Long id,
            @RequestBody InstallationFinancialApprovalRequest req) {
        if (etlApiKey == null || etlApiKey.isBlank() || !etlApiKey.equals(providedKey)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        try {
            return ResponseEntity.ok(service.updateFinancialApproval(id, req));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/{id}/calculate-displacement")
    public ResponseEntity<Map<String, Object>> calculateDisplacement(
            @RequestHeader(value = "X-ETL-Key", required = false) String providedKey,
            @PathVariable Long id,
            @RequestParam UUID technicianId) {
        if (etlApiKey == null || etlApiKey.isBlank() || !etlApiKey.equals(providedKey)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        try {
            return ResponseEntity.ok(service.calculateDisplacement(id, technicianId));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/diagnostic/status-count")
    public ResponseEntity<Map<String, Long>> diagnosticStatusCount() {
        Map<String, Long> counts = service.countByPortalStatus();
        return ResponseEntity.ok(counts);
    }

    // ─────────────────────────────────────────────────────────────────────────

    @PostMapping("/sync-portal")
    public InstallationSyncResult syncPortal() {
        return syncService.syncFromPortal();
    }

    @GetMapping("/last-sync")
    public ResponseEntity<InstallationSyncResult> lastSync() {
        InstallationSyncResult result = syncService.getLastResult();
        if (result == null) return ResponseEntity.noContent().build();
        return ResponseEntity.ok(result);
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
