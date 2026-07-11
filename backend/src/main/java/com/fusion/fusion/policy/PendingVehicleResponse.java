package com.fusion.fusion.policy;

import com.fusion.fusion.vehicle.VehiclePlatform;

import java.util.UUID;

public record PendingVehicleResponse(
        UUID id,
        String plate,
        String insuredName,
        VehiclePlatform platform
) {
}
