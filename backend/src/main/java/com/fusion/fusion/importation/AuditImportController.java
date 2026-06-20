package com.fusion.fusion.importation;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/audit")
@RequiredArgsConstructor
public class AuditImportController {

    private final ImportHistoryRepository repository;

    @GetMapping("/imports")
    public List<ImportHistoryResponse> imports() {

        return repository.findTop50ByOrderByCreatedAtDesc()
                .stream()
                .map(ImportHistoryResponse::from)
                .toList();

    }

}
