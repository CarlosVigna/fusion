package com.fusion.fusion.letter;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/letters")
@RequiredArgsConstructor
public class LetterRecordController {

    private final LetterRecordService service;

    @GetMapping
    public List<LetterRecordResponse> findAll(
            @RequestParam(required = false) String status
    ) {

        return service.findAll("ALL".equalsIgnoreCase(status));

    }

    @GetMapping("/pending-baixa")
    public List<LetterRecordResponse> findPendingBaixa() {

        return service.findPendingBaixa();

    }

    @PostMapping
    public LetterRecordResponse create(
            @Valid @RequestBody LetterRecordRequest request
    ) {

        return service.create(request);

    }

    @PutMapping("/{id}")
    public LetterRecordResponse update(
            @PathVariable Long id,
            @Valid @RequestBody LetterRecordRequest request
    ) {

        return service.update(id, request);

    }

    @PutMapping("/{id}/baixar")
    public LetterRecordResponse baixar(
            @PathVariable Long id
    ) {

        return service.baixar(id);

    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {

        service.delete(id);

    }

}
