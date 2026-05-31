package com.fusion.fusion.vehicle.multiportal.operational;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/multiportal/operational")
@RequiredArgsConstructor
public class MultiportalOperationalController {

    private final MultiportalOperationalService service;

    @PostMapping("/update")
    public OperationalUpdateResponse update(
            @RequestBody OperationalUpdateRequest request
    ) {

        return service.update(request);

    }

}