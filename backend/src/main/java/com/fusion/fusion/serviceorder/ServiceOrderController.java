package com.fusion.fusion.serviceorder;

import com.fusion.fusion.serviceorder.audit.ServiceOrderAuditLog;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/service-orders")
@RequiredArgsConstructor
public class ServiceOrderController {

    private final ServiceOrderService service;

    @Value("${fusion.etl.api-key:}")
    private String etlApiKey;

    @GetMapping
    public List<ServiceOrderResponse> listAll(
            @RequestParam(defaultValue = "false") boolean includeCompleted,
            @RequestParam(required = false) ServiceType serviceType) {
        return service.listAll(includeCompleted, serviceType);
    }

    @GetMapping("/completed")
    public List<ServiceOrderResponse> listCompleted() {
        return service.listCompleted();
    }

    // Chamado pelo bot do WhatsApp (approvalFlow.js, fusion-etl), nao por
    // usuario logado no navegador — autenticado por X-ETL-Key (mesmo
    // padrao de POST /installations/sync e do extinto POST
    // /installations/whatsapp-approve), nao por JWT/role. Ver permitAll
    // em SecurityConfig.
    @GetMapping("/by-plate")
    public ResponseEntity<?> findByPlate(
            @RequestHeader(value = "X-ETL-Key", required = false) String providedKey,
            @RequestParam String plate
    ) {
        if (etlApiKey == null || etlApiKey.isBlank() || !etlApiKey.equals(providedKey)) {
            log.warn("GET /service-orders/by-plate rejeitado: X-ETL-Key inválida ou ausente");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Chave de API inválida"));
        }
        return ResponseEntity.ok(service.findOpenByPlate(plate));
    }

    // Variante de PUT /{id}/financial-approval exclusiva pro bot —
    // o endpoint original fica como esta' (hasAnyRole ADMIN/OPERATOR/
    // FIELD/TECHNICIAN via JWT, usado pelo dashboard), autenticar ele
    // por X-ETL-Key tambem exigiria reimplementar a checagem de role
    // manualmente dentro do metodo pra nao abrir a acao financeira pra
    // qualquer requisicao anonima. Endpoint separado evita esse risco
    // e reaproveita a mesma logica de negocio (service.updateFinancialApproval).
    @PutMapping("/{id}/financial-approval-whatsapp")
    public ResponseEntity<?> updateFinancialApprovalFromWhatsApp(
            @RequestHeader(value = "X-ETL-Key", required = false) String providedKey,
            @PathVariable UUID id,
            @RequestBody FinancialApprovalRequest request
    ) {
        if (etlApiKey == null || etlApiKey.isBlank() || !etlApiKey.equals(providedKey)) {
            log.warn("PUT /service-orders/{}/financial-approval-whatsapp rejeitado: X-ETL-Key inválida ou ausente", id);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Chave de API inválida"));
        }
        return ResponseEntity.ok(service.updateFinancialApproval(id, request));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ServiceOrderResponse create(
            @RequestBody ServiceOrderRequest request,
            @AuthenticationPrincipal UserDetails user
    ) {
        return service.create(request, user != null ? user.getUsername() : "SISTEMA");
    }

    @PutMapping("/{id}")
    public ServiceOrderResponse update(@PathVariable UUID id, @RequestBody ServiceOrderRequest request) {
        return service.update(id, request);
    }

    @PutMapping("/{id}/scheduling")
    public ServiceOrderResponse updateScheduling(@PathVariable UUID id, @RequestBody SchedulingRequest request) {
        return service.updateScheduling(id, request);
    }

    @PutMapping("/{id}/financial-approval")
    public ServiceOrderResponse updateFinancialApproval(@PathVariable UUID id, @RequestBody FinancialApprovalRequest request) {
        return service.updateFinancialApproval(id, request);
    }

    @PutMapping("/{id}/confirm-completion")
    public ServiceOrderResponse confirmCompletion(@PathVariable UUID id) {
        return service.confirmCompletion(id);
    }

    @PutMapping("/{id}/link-plate")
    public ServiceOrderResponse linkPlate(@PathVariable UUID id, @RequestBody LinkPlateRequest request) {
        return service.linkPlate(id, request.plate());
    }

    @PostMapping("/{id}/conclude-legacy")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> concludeLegacy(@PathVariable UUID id, Authentication auth) {
        service.concludeAsLegacy(id, auth.getName());
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{id}/vehicle-signal")
    public Map<String, Boolean> vehicleSignal(@PathVariable UUID id) {
        return Map.of("hasSignal", service.hasVehicleSignal(id));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> delete(@PathVariable UUID id, Authentication auth) {
        service.delete(id, auth.getName());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/revert-completion")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> revertCompletion(@PathVariable UUID id, Authentication auth) {
        service.revertCompletion(id, auth.getName());
        return ResponseEntity.ok().build();
    }

    @GetMapping("/audit-log")
    public List<ServiceOrderAuditLog> auditLog(
            @RequestParam(required = false) String plate,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String performedBy,
            @RequestParam(required = false) String dateFrom,
            @RequestParam(required = false) String dateTo
    ) {
        return service.getAuditLog(plate, action, performedBy, dateFrom, dateTo);
    }

    @GetMapping("/{id}/audit-log")
    public List<ServiceOrderAuditLog> auditLogForOrder(@PathVariable UUID id) {
        return service.getAuditLogForOrder(id);
    }

    @GetMapping("/dashboard")
    public Map<String, Object> dashboard(@AuthenticationPrincipal UserDetails user) {
        boolean showAnalytics = user != null && user.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN") || a.getAuthority().equals("ROLE_OPERATOR"));
        return service.dashboard(showAnalytics);
    }

    @GetMapping("/monthly-close")
    public Map<String, Object> monthlyClose(@RequestParam String month) {
        return service.monthlyClose(month);
    }

    @GetMapping("/monthly-close/excel")
    public ResponseEntity<ByteArrayResource> monthlyCloseExcel(@RequestParam String month) {
        Map<String, Object> data = service.monthlyClose(month);
        @SuppressWarnings("unchecked")
        List<ServiceOrderResponse> orders = (List<ServiceOrderResponse>) data.get("orders");

        StringBuilder csv = new StringBuilder("ID,Placa,Solicitante,Data,Técnico,Status,Serviço,Deslocamento,Total\n");
        for (ServiceOrderResponse o : orders) {
            csv.append(o.id()).append(",")
               .append(nvl(o.plate())).append(",")
               .append(nvl(o.requestedBy())).append(",")
               .append(nvl(o.requestedAt())).append(",")
               .append(o.technician() != null ? nvl(o.technician().name()) : "").append(",")
               .append(nvl(o.schedulingStatus())).append(",")
               .append(nvl(o.serviceValue())).append(",")
               .append(nvl(o.displacementValue())).append(",")
               .append(nvl(o.totalValue())).append("\n");
        }

        byte[] bytes = csv.toString().getBytes(StandardCharsets.UTF_8);
        ByteArrayResource resource = new ByteArrayResource(bytes);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"fechamento-" + month + ".csv\"")
                .contentType(MediaType.parseMediaType("text/csv"))
                .contentLength(bytes.length)
                .body(resource);
    }

    @GetMapping("/monthly-close/pdf")
    public ResponseEntity<ByteArrayResource> monthlyClosePdf(@RequestParam String month) {
        Map<String, Object> data = service.monthlyClose(month);
        String html = buildPdfHtml(data, month);
        byte[] bytes = html.getBytes(StandardCharsets.UTF_8);
        ByteArrayResource resource = new ByteArrayResource(bytes);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"fechamento-" + month + ".html\"")
                .contentType(MediaType.TEXT_HTML)
                .contentLength(bytes.length)
                .body(resource);
    }

    private String buildPdfHtml(Map<String, Object> data, String month) {
        @SuppressWarnings("unchecked")
        List<ServiceOrderResponse> orders = (List<ServiceOrderResponse>) data.get("orders");
        StringBuilder sb = new StringBuilder();
        sb.append("<!DOCTYPE html><html><head><meta charset='UTF-8'><title>Fechamento ").append(month)
          .append("</title><style>body{font-family:sans-serif;font-size:12px}table{width:100%;border-collapse:collapse}")
          .append("th,td{border:1px solid #ccc;padding:4px 8px}th{background:#f0f0f0}</style></head><body>");
        sb.append("<h2>Fechamento Mensal — ").append(month).append("</h2>");
        sb.append("<p>Ordens concluídas: <strong>").append(data.get("count")).append("</strong></p>");
        sb.append("<p>Valor serviço: R$ ").append(data.get("totalServiceValue"))
          .append(" | Deslocamento: R$ ").append(data.get("totalDisplacementValue"))
          .append(" | Total: R$ ").append(data.get("totalValue")).append("</p>");
        sb.append("<table><tr><th>Placa</th><th>Solicitante</th><th>Técnico</th><th>Encerrada</th><th>Serviço</th><th>Desl.</th><th>Total</th></tr>");
        for (ServiceOrderResponse o : orders) {
            sb.append("<tr><td>").append(nvl(o.plate())).append("</td>")
              .append("<td>").append(nvl(o.requestedBy())).append("</td>")
              .append("<td>").append(o.technician() != null ? nvl(o.technician().name()) : "-").append("</td>")
              .append("<td>").append(nvl(o.closedAt())).append("</td>")
              .append("<td>R$ ").append(nvl(o.serviceValue())).append("</td>")
              .append("<td>R$ ").append(nvl(o.displacementValue())).append("</td>")
              .append("<td>R$ ").append(nvl(o.totalValue())).append("</td></tr>");
        }
        sb.append("</table></body></html>");
        return sb.toString();
    }

    private String nvl(Object o) {
        return o != null ? o.toString() : "";
    }
}
