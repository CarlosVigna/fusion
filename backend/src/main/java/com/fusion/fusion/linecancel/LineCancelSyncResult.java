package com.fusion.fusion.linecancel;

public record LineCancelSyncResult(
        int created,
        int backfilled,
        int skippedHasActivePolicy,
        int resolvedObsolete
) {
}
