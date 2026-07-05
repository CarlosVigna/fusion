package com.fusion.fusion.dashboard;

import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

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

    // Cards da Central Operacional (Sprint 2)
    private Long registeredVehicles;

    private Long monitoredVehicles;

    private Long activeLettersCount;

    private Long pendingLettersCount;

    private Long pendingChangesCount;

    private Long delayedSignalCount;

    private Long overdueMaintenanceCount;

    private Long importsTodayCount;

    private LocalDateTime lastEtlUpdate;

}