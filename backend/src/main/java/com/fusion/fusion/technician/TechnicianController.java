package com.fusion.fusion.technician;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/technicians")
@RequiredArgsConstructor
public class TechnicianController {

    private final TechnicianService service;

    @GetMapping
    public List<TechnicianResponse> listAll() {
        return service.listAll();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TechnicianResponse create(@RequestBody TechnicianRequest request) {
        return service.create(request);
    }

    @PutMapping("/{id}")
    public TechnicianResponse update(@PathVariable UUID id, @RequestBody TechnicianRequest request) {
        return service.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        service.delete(id);
    }
}
