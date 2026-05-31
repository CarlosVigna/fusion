package com.fusion.fusion.audit;

import java.time.LocalDateTime;
import java.util.UUID;

public record AuditResponse(

        UUID id,

        String userName,

        String action,

        String fieldName,

        String oldValue,

        String newValue,

        LocalDateTime createdAt

) {
}