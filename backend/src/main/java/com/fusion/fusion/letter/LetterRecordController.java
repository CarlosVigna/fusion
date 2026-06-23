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
    public List<LetterRecordResponse> findAll() {

        return service.findAll();

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

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {

        service.delete(id);

    }

}
