package com.fusion.fusion.signalcontrol;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/vehicles/signal-control")
@RequiredArgsConstructor
public class SignalControlController {

    private final SignalControlService service;

    @GetMapping
    public List<SignalControlResponse> findAll(
            @RequestParam(defaultValue = "false") boolean includeKako
    ) {

        return service.findAll(includeKako);

    }

}
