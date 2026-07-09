package com.fusion.fusion.vehicle.grid;

import com.fusion.fusion.vehicle.OperationalStatus;
import com.fusion.fusion.vehicle.VehicleGroup;
import com.fusion.fusion.vehicle.VehiclePlatform;
import com.fusion.fusion.vehicle.operational.CommunicationStatus;

import java.time.LocalDateTime;
import java.util.UUID;

public record GridVehicleResponse(

        UUID id,

        String plate,

        String insuredName,

        VehiclePlatform platform,

        Boolean online,

        Integer batteryLevel,

        LocalDateTime lastCommunicationAt,

        Boolean inMaintenance,

        String maintenanceOperator,

        String activeDevice,

        String manufacturer,

        String model,

        String lineNumber,

        String operator,

        OperationalStatus status,

        CommunicationStatus communicationStatus,

        Integer signalDelayMinutes,

        Boolean staleUpdate,

        Boolean lowBattery,

        String lastObservationText,

        LocalDateTime lastObservationAt,

        VehicleGroup vehicleGroup

) {
}