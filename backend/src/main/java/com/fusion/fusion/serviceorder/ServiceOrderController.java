package com.fusion.fusion.serviceorder;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/service-orders")
@RequiredArgsConstructor
public class ServiceOrderController {

    private final ServiceOrderService service;

    @GetMapping
    public List<ServiceOrderResponse> listAll(
            @RequestParam(defaultValue = "false") boolean includeCompleted) {
        return service.listAll(includeCompleted);
    }

    @GetMapping("/completed")
    public List<ServiceOrderResponse> listCompleted() {
        return service.listCompleted();
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

    @GetMapping("/{id}/vehicle-signal")
    public Map<String, Boolean> vehicleSignal(@PathVariable UUID id) {
        return Map.of("hasSignal", service.hasVehicleSignal(id));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        service.delete(id);
    }

    @GetMapping("/dashboard")
    public Map<String, Object> dashboard(@AuthenticationPrincipal UserDetails user) {
        boolean showAnalytics = user != null && user.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN") || a.getAuthority().equals("ROLE_OPERATOR"));
        return service.dashboard(showAnalytics);
    }

    @GetMapping("/audit-log")
    public ResponseEntity<?> auditLog(
            @RequestParam(required = false) String plate,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String performedBy,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateTo) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean isAdmin = auth != null && auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        if (!isAdmin) {
            return ResponseEntity.status(403).build();
        }
        LocalDateTime from = dateFrom != null ? dateFrom.atStartOfDay() : null;
        LocalDateTime to   = dateTo   != null ? dateTo.atTime(23, 59, 59) : null;
        return ResponseEntity.ok(service.findAuditLog(plate, action, performedBy, from, to));
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
