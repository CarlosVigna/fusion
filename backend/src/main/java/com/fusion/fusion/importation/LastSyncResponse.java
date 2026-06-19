package com.fusion.fusion.importation;

import java.time.LocalDateTime;

public record LastSyncResponse(

        LocalDateTime lastSync,

        ImportType type,

        ImportStatus status

) {
}
