package com.fusion.fusion.importation;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ImportHistoryRepository
        extends JpaRepository<ImportHistory, UUID> {

    Optional<ImportHistory> findTopByStatusOrderByCreatedAtDesc(
            ImportStatus status
    );

    Optional<ImportHistory> findTopByTypeAndStatusOrderByCreatedAtDesc(
            ImportType type,
            ImportStatus status
    );

    List<ImportHistory> findTop50ByOrderByCreatedAtDesc();

    long countByCreatedAtAfterAndStatus(
            LocalDateTime after,
            ImportStatus status
    );

}