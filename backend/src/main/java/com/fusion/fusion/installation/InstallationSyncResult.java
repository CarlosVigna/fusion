package com.fusion.fusion.installation;

import java.time.LocalDateTime;

public record InstallationSyncResult(
        int found,
        int inserted,
        int skipped,
        int closed,
        LocalDateTime syncedAt
) {}
