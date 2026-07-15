package com.fusion.fusion.policy;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/policies")
@RequiredArgsConstructor
public class PolicyController {

    private final PolicyService service;

    @GetMapping
    public List<PolicyResponse> findAll(
            @RequestParam(required = false) String plate,
            @RequestParam(required = false) String status
    ) {
        return service.findAll(plate, status);
    }

    @GetMapping("/pending-vehicles")
    public List<PendingVehicleResponse> findPendingVehicles() {
        return service.findPendingVehicles();
    }

    @GetMapping("/expiring")
    public List<PolicyResponse> findExpiring(
            @RequestParam(defaultValue = "30") int days
    ) {
        return service.findExpiring(days);
    }

    @GetMapping("/expired")
    public List<PolicyResponse> findExpired() {
        return service.findExpired();
    }

    @GetMapping("/inactive")
    public List<PolicyResponse> findInactive() {
        return service.findInactive();
    }

    @GetMapping("/badge-counts")
    public PolicyBadgeCountsResponse getBadgeCounts() {
        return service.getBadgeCounts();
    }

    @GetMapping("/alerts")
    public List<PolicyAlertResponse> getAlerts() {
        return service.getAlerts();
    }

    @PostMapping("/{id}/cancel")
    public void cancelPolicy(@PathVariable Long id) {
        service.cancelPolicy(id);
    }

    @PostMapping("/{id}/dismiss-alert")
    public void dismissAlert(@PathVariable Long id) {
        service.dismissAlert(id);
    }

    @PostMapping("/fetch")
    public EtlPolicyResult fetchFromPortal(
            @RequestParam String plate
    ) {
        return service.fetchFromPortal(plate);
    }

    @GetMapping("/report")
    public List<PolicyReportRow> getReport(
            @RequestParam String type
    ) {
        return service.getReport(type);
    }

    @PostMapping("/verify-all")
    public ResponseEntity<Map<String, String>> startVerification() {
        String jobId = UUID.randomUUID().toString();
        service.startVerificationAsync(jobId);
        return ResponseEntity.ok(Map.of("jobId", jobId));
    }

    @GetMapping("/verify-status/{jobId}")
    public ResponseEntity<VerificationJob> getVerificationStatus(
            @PathVariable String jobId
    ) {
        return ResponseEntity.ok(service.getVerificationStatus(jobId));
    }

    @PostMapping
    public PolicyResponse create(
            @RequestBody PolicyRequest request
    ) {
        return service.create(request);
    }

    @PutMapping("/{id}")
    public PolicyResponse update(
            @PathVariable Long id,
            @RequestBody PolicyRequest request
    ) {
        return service.update(id, request);
    }

    @DeleteMapping("/{id}")
    public void delete(
            @PathVariable Long id
    ) {
        service.delete(id);
    }

}
