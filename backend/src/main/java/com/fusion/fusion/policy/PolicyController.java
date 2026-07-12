package com.fusion.fusion.policy;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

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

    @GetMapping("/badge-counts")
    public PolicyBadgeCountsResponse getBadgeCounts() {
        return service.getBadgeCounts();
    }

    @PostMapping("/fetch")
    public EtlPolicyResult fetchFromPortal(
            @RequestParam String plate
    ) {
        return service.fetchFromEtl(plate);
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
