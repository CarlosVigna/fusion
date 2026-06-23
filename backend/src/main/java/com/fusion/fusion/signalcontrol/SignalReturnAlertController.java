package com.fusion.fusion.signalcontrol;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/alerts/signal-return")
@RequiredArgsConstructor
public class SignalReturnAlertController {

    private final SignalReturnAlertService service;

    @GetMapping
    public List<SignalReturnAlertResponse> findActive() {

        return service.findActive();

    }

    @PostMapping("/{id}/dismiss")
    public void dismiss(@PathVariable Long id) {

        service.dismiss(id);

    }

}
