package com.fusion.fusion.vehicle.tracknme;

import java.time.LocalDateTime;

public record TracknMePendingResponse(
        String plate,
        String tracknmeDeviceId,
        LocalDateTime createdAt
) {}
