package com.fusion.fusion.etl;

import com.fusion.fusion.importation.ImportType;

import java.time.LocalDateTime;

public record EtlStatusResponse(

        ImportType type,

        EtlRunStatus status,

        LocalDateTime lastRunAt,

        Long lastDurationMs,

        String lastError,

        Integer lastRecordsProcessed,

        LocalDateTime nextRunAt,

        LocalDateTime updatedAt

) {

    public static EtlStatusResponse from(EtlStatus status) {

        return new EtlStatusResponse(

                status.getType(),

                status.getStatus(),

                status.getLastRunAt(),

                status.getLastDurationMs(),

                status.getLastError(),

                status.getLastRecordsProcessed(),

                status.getNextRunAt(),

                status.getUpdatedAt()

        );

    }

}
