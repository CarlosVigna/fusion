package com.fusion.fusion.etl;

import com.fusion.fusion.importation.ImportType;

import java.time.LocalDateTime;

public record EtlStatusDto(
        ImportType type,
        EtlRunStatus status,
        Long durationMs,
        String error,
        Integer recordsProcessed,
        LocalDateTime nextRunAt
) {}
