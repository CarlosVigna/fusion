package com.fusion.fusion.importation;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ImportDiffLogRepository extends JpaRepository<ImportDiffLog, UUID> {

    List<ImportDiffLog> findByDismissedFalseOrderByCreatedAtDesc();

}
