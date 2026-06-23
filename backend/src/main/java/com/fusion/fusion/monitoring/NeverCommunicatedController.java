package com.fusion.fusion.monitoring;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/vehicles/never-communicated")
@RequiredArgsConstructor
public class NeverCommunicatedController {

    private final NeverCommunicatedService service;

    @GetMapping
    public List<NeverCommunicatedResponse> findAll() {

        return service.findAll();

    }

}
