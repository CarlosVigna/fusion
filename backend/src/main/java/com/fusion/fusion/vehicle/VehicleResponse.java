package com.fusion.fusion.vehicle;

import java.time.LocalDateTime;
import java.util.UUID;

public record VehicleResponse(

        UUID id,

        String plate,

        String insuredName,

        VehiclePlatform platform,

        String partnership,

        String policy,

        String broker,

        Boolean inMaintenance,

        Integer batteryLevel,

        Boolean online,

        LocalDateTime lastUpdateAt

) {
}