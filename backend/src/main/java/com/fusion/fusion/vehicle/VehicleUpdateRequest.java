package com.fusion.fusion.vehicle;

public record VehicleUpdateRequest(

        String insuredName,

        VehiclePlatform platform,

        String partnership,

        String policy,

        String broker,

        String notes,

        Boolean inMaintenance,

        String maintenanceNotes,

        String maintenanceOperator

) {
}