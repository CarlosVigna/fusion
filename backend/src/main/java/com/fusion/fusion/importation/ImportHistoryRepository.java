package com.fusion.fusion.importation;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface ImportHistoryRepository
        extends JpaRepository<ImportHistory, UUID> {
}