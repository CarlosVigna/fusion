package com.fusion.fusion.policy;

public record PolicyBadgeCountsResponse(
        long expired,
        long expiring
) {
}
