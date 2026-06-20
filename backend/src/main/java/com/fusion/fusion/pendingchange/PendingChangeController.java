package com.fusion.fusion.pendingchange;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/pending-changes")
@RequiredArgsConstructor
public class PendingChangeController {

    private final PendingChangeService service;

    @GetMapping
    public List<PendingChangeResponse> findPending() {

        return service.findPending()
                .stream()
                .map(PendingChangeResponse::from)
                .toList();

    }

    @PostMapping("/{id}/approve")
    public void approve(@PathVariable Long id) {

        service.approve(id);

    }

    @PostMapping("/{id}/reject")
    public void reject(@PathVariable Long id) {

        service.reject(id);

    }

}
