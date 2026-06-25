package com.fusion.fusion.preference;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/preferences")
@RequiredArgsConstructor
public class UserPreferenceController {

    private final UserPreferenceService service;

    @GetMapping("/{key}")
    public PreferenceResponse get(@PathVariable String key) {

        return new PreferenceResponse(service.get(key));

    }

    @PutMapping("/{key}")
    public PreferenceResponse save(
            @PathVariable String key,
            @Valid @RequestBody PreferenceRequest request
    ) {

        return new PreferenceResponse(
                service.save(key, request.value())
        );

    }

}
