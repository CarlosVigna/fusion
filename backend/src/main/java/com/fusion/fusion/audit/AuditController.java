package com.fusion.fusion.audit;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/audits")
@RequiredArgsConstructor
public class AuditController {

    private final AuditService service;

    @GetMapping("/vehicle/{plate}")
    public List<AuditResponse> findVehicleHistory(
            @PathVariable String plate
    ) {

        return service.findVehicleHistory(plate);

    }

}