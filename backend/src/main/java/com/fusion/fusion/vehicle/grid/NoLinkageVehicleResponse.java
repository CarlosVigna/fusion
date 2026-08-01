package com.fusion.fusion.vehicle.grid;

import com.fusion.fusion.vehicle.VehicleGroup;

public record NoLinkageVehicleResponse(
        String plate,
        String insuredName,
        VehicleGroup vehicleGroup
) {}
