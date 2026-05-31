package com.fusion.fusion.realtime;

import com.fusion.fusion.dashboard.DashboardProjection;
import com.fusion.fusion.dashboard.DashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class DashboardRealtimeService {

    private final SimpMessagingTemplate
            messagingTemplate;

    private final DashboardService
            dashboardService;

    public void publish(
            String type,
            String message
    ) {

        DashboardProjection dashboard =
                dashboardService.build();

        DashboardRealtimeEvent event =
                DashboardRealtimeEvent.builder()
                        .type(type)
                        .message(message)
                        .dashboard(dashboard)
                        .build();

        messagingTemplate.convertAndSend(
                "/topic/dashboard",
                event
        );

    }

}