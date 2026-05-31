package com.fusion.fusion.operational.listener;

import com.fusion.fusion.operational.event.CommunicationDelayedEvent;
import com.fusion.fusion.operational.event.CommunicationLostEvent;
import com.fusion.fusion.operational.event.CommunicationRestoredEvent;
import com.fusion.fusion.timeline.TimelineEventType;
import com.fusion.fusion.timeline.service.TimelineService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import com.fusion.fusion.operational.event.LowBatteryEvent;
import com.fusion.fusion.operational.event.StaleUpdateEvent;

@Component
@RequiredArgsConstructor
public class OperationalTimelineListener {

    private final TimelineService timelineService;

    @EventListener
    public void handleDelayed(
            CommunicationDelayedEvent event
    ) {

        timelineService.register(
                event.vehicle(),
                null,
                TimelineEventType.COMMUNICATION_DELAYED,
                event.description()
        );

    }

    @EventListener
    public void handleLowBattery(
            LowBatteryEvent event
    ) {

        timelineService.register(
                event.vehicle(),
                null,
                TimelineEventType.LOW_BATTERY_DETECTED,
                event.description()
        );

    }

    @EventListener
    public void handleStaleUpdate(
            StaleUpdateEvent event
    ) {

        timelineService.register(
                event.vehicle(),
                null,
                TimelineEventType.STALE_UPDATE_DETECTED,
                event.description()
        );

    }

    @EventListener
    public void handleLost(
            CommunicationLostEvent event
    ) {

        timelineService.register(
                event.vehicle(),
                null,
                TimelineEventType.COMMUNICATION_LOST,
                event.description()
        );

    }

    @EventListener
    public void handleRestored(
            CommunicationRestoredEvent event
    ) {

        timelineService.register(
                event.vehicle(),
                null,
                TimelineEventType.COMMUNICATION_ONLINE,
                event.description()
        );

    }

}