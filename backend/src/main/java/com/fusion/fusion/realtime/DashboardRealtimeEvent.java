package com.fusion.fusion.realtime;

import com.fusion.fusion.dashboard.DashboardProjection;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class DashboardRealtimeEvent {

    private String type;

    private String message;

    private DashboardProjection dashboard;

}