package com.fusion.fusion.dashboard;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class DashboardResponse {

    private Long totalVehicles;

    private Long onlineVehicles;

    private Long delayedVehicles;

    private Long noCommunicationVehicles;

    private Long openAlerts;

}