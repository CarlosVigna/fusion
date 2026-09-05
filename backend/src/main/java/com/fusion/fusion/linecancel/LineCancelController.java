package com.fusion.fusion.linecancel;

import com.fusion.fusion.common.security.CurrentUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/line-cancels")
@RequiredArgsConstructor
public class LineCancelController {

    private final LineCancelService service;

    private final CurrentUserService currentUserService;

    @GetMapping
    public List<LineCancelResponse> findAll(
            @RequestParam(required = false) LineCancelStatus status
    ) {

        return service.findAll(status);

    }

    @PostMapping("/sync")
    public Map<String, Integer> sync() {

        int created = service.syncFromPolicies();

        return Map.of("created", created);

    }

    @PutMapping("/{id}/verify")
    public LineCancelResponse verify(@PathVariable UUID id) {

        return service.markVerified(id, currentUserService.getCurrentUserName());

    }

    @PutMapping("/{id}/request")
    public LineCancelResponse request(@PathVariable UUID id) {

        return service.markRequested(id, currentUserService.getCurrentUserName());

    }

    @PutMapping("/{id}/done")
    public LineCancelResponse done(@PathVariable UUID id) {

        return service.markDone(id);

    }

    @PostMapping("/email")
    public Map<String, String> email(@RequestBody LineCancelEmailRequest request) {

        return Map.of("text", service.generateCancelEmail(request.ids()));

    }

}
