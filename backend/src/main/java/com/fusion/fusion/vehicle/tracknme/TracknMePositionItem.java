package com.fusion.fusion.vehicle.tracknme;

public record TracknMePositionItem(
        String deviceId,
        Double latitude,
        Double longitude,
        String dateTime,
        boolean online
) {}
