package com.fusion.fusion.installation;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
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

    @GetMapping("/portal-status")
    public Map<String, Object> portalStatus() {
        return service.getPortalStatusGroups();
    }

    // Diagnostico temporario (Fase 2b) — contagem real por portalStatus
    // no banco, pra comparar com o portal e confirmar a varredura de
    // orfaos. Sem X-ETL-Key: pensado pra ser aberto no navegador por
    // usuario logado (cai em anyRequest().authenticated() default).
    @GetMapping("/diagnostic/status-count")
    public Map<String, Long> diagnosticStatusCount() {
        return service.getDiagnosticStatusCount();
    }

    // Chamado pelo bot do WhatsApp (approvalFlow.js, fusion-etl) em
    // !aprovar-inst, pra calcular deslocamento sob demanda — Installation
    // nao tem lat/lon do cliente pre-calculados (ver InstallationService.
    // calculateDisplacement). Autenticado por X-ETL-Key, mesmo padrao dos
    // outros endpoints do ETL.
    @GetMapping("/{id}/calculate-displacement")
    public ResponseEntity<?> calculateDisplacement(
            @RequestHeader(value = "X-ETL-Key", required = false) String providedKey,
            @PathVariable Long id,
            @RequestParam UUID technicianId
    ) {
        if (etlApiKey == null || etlApiKey.isBlank() || !etlApiKey.equals(providedKey)) {
            log.warn("GET /installations/{}/calculate-displacement rejeitado: X-ETL-Key inválida ou ausente", id);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Chave de API inválida"));
        }
        return ResponseEntity.ok(service.calculateDisplacement(id, technicianId));
    }

    // Chamado pelo bot do WhatsApp (approvalFlow.js, fusion-etl) no
    // comando !aprovar-inst — autenticado por X-ETL-Key, mesmo padrao de
    // GET /service-orders/by-plate. Ver permitAll em SecurityConfig.
    @GetMapping("/by-plate")
    public ResponseEntity<?> findByPlate(
            @RequestHeader(value = "X-ETL-Key", required = false) String providedKey,
            @RequestParam String plate
    ) {
        if (etlApiKey == null || etlApiKey.isBlank() || !etlApiKey.equals(providedKey)) {
            log.warn("GET /installations/by-plate rejeitado: X-ETL-Key inválida ou ausente");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Chave de API inválida"));
        }
        return ResponseEntity.ok(service.findByPlate(plate));
    }

    // Idem findByPlate — chamado em !aprovado-inst/!rejeitar-inst. Nao ha
    // endpoint JWT equivalente hoje (Installation ainda nao tem tela de
    // aprovacao financeira pro usuario logado), entao esse caminho fica
    // so' ETL por enquanto — se um dia existir uma tela assim, seguir o
    // padrao de ServiceOrderController (endpoint separado "-whatsapp").
    @PutMapping("/{id}/financial-approval")
    public ResponseEntity<?> updateFinancialApproval(
            @RequestHeader(value = "X-ETL-Key", required = false) String providedKey,
            @PathVariable Long id,
            @RequestBody InstallationFinancialApprovalRequest request
    ) {
        if (etlApiKey == null || etlApiKey.isBlank() || !etlApiKey.equals(providedKey)) {
            log.warn("PUT /installations/{}/financial-approval rejeitado: X-ETL-Key inválida ou ausente", id);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Chave de API inválida"));
        }
        return ResponseEntity.ok(service.updateFinancialApproval(id, request));
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

    @GetMapping("/report")
    public List<InstallationResponse> report(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate
    ) {
        LocalDate start = (startDate != null && !startDate.isBlank()) ? LocalDate.parse(startDate) : null;
        LocalDate end = (endDate != null && !endDate.isBlank()) ? LocalDate.parse(endDate) : null;
        return service.report(search, status, start, end);
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
