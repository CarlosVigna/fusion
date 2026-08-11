package com.fusion.fusion.vehicle.tracknme;

public record TracknMeDeviceItem(
        String id,
        String label,
        boolean active,
        String imei,
        String model,
        String operator,
        String simCard,
        String number
) {}
