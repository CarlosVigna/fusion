package com.fusion.fusion.importation;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface ImportDiffLogRepository extends JpaRepository<ImportDiffLog, UUID> {

    List<ImportDiffLog> findByDismissedFalseOrderByCreatedAtDesc();

    List<ImportDiffLog> findByImportTypeInOrderByCreatedAtDesc(Collection<ImportType> importTypes);

    List<ImportDiffLog> findByImportTypeInAndCreatedAtBetweenOrderByCreatedAtDesc(
            Collection<ImportType> importTypes,
            java.time.LocalDateTime from,
            java.time.LocalDateTime to);

    // Usado pela limpeza periodica (CleanupScheduler) — so remove diffs ja
    // dismissados (vistos no sino). Um diff ainda nao visto nunca e'
    // apagado so por idade.
    long deleteByDismissedTrueAndCreatedAtBefore(java.time.LocalDateTime before);

}
