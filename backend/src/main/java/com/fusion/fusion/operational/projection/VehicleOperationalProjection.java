package com.fusion.fusion.operational.projection;

import com.fusion.fusion.vehicle.OperationalStatus;
import com.fusion.fusion.vehicle.Vehicle;
import com.fusion.fusion.vehicle.operational.CommunicationStatus;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class VehicleOperationalProjection {

    private Vehicle vehicle;

    private Boolean online;

    private Integer batteryLevel;

    private CommunicationStatus communicationStatus;

    private Integer signalDelayMinutes;

    private Boolean staleUpdate;

    private Boolean lowBattery;

    private OperationalStatus operationalStatus;

    private LocalDateTime lastCommunicationAt;

}