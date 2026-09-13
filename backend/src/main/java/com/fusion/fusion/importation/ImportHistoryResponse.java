package com.fusion.fusion.importation;

import java.time.LocalDateTime;

public record ImportHistoryResponse(

        ImportType type,

        String fileName,

        Integer processedRecords,

        Integer updatedRecords,

        ImportStatus status,

        LocalDateTime createdAt,

        String importedBy

) {

    public static ImportHistoryResponse from(ImportHistory history) {

        return new ImportHistoryResponse(
                history.getType(),
                history.getFileName(),
                history.getProcessedRecords(),
                history.getUpdatedRecords(),
                history.getStatus(),
                history.getCreatedAt(),
                history.getImportedBy() != null
                        ? history.getImportedBy().getName()
                        : "Sistema (agendado)"
        );

    }

}
