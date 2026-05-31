package com.fusion.fusion.dashboard;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class DashboardProjection {

    private Long totalVehicles;

    private Long onlineVehicles;

    private Long delayedVehicles;

    private Long noCommunicationVehicles;

    private Long maintenanceVehicles;

    private Long lowBatteryVehicles;

    private Long staleVehicles;

    private Long openAlerts;

}