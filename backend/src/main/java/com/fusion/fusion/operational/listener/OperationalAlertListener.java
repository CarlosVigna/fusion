package com.fusion.fusion.operational.listener;

import com.fusion.fusion.alert.OperationalAlertType;
import com.fusion.fusion.alert.service.OperationalAlertService;
import com.fusion.fusion.operational.event.CommunicationDelayedEvent;
import com.fusion.fusion.operational.event.CommunicationLostEvent;
import com.fusion.fusion.operational.event.CommunicationRestoredEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import com.fusion.fusion.operational.event.LowBatteryEvent;
import com.fusion.fusion.operational.event.StaleUpdateEvent;

@Component
@RequiredArgsConstructor
public class OperationalAlertListener {

    private final OperationalAlertService alertService;

    @EventListener
    public void handleDelayed(
            CommunicationDelayedEvent event
    ) {

        alertService.openAlert(
                event.vehicle(),
                OperationalAlertType.COMMUNICATION_DELAY,
                event.description()
        );

    }

    @EventListener
    public void handleLost(
            CommunicationLostEvent event
    ) {

        alertService.openAlert(
                event.vehicle(),
                OperationalAlertType.NO_COMMUNICATION,
                event.description()
        );

    }

    @EventListener
    public void handleLowBattery(
            LowBatteryEvent event
    ) {

        alertService.openAlert(
                event.vehicle(),
                OperationalAlertType.LOW_BATTERY,
                event.description()
        );

    }

    @EventListener
    public void handleStaleUpdate(
            StaleUpdateEvent event
    ) {

        alertService.openAlert(
                event.vehicle(),
                OperationalAlertType.STALE_UPDATE,
                event.description()
        );

    }

    @EventListener
    public void handleRestored(
            CommunicationRestoredEvent event
    ) {

        alertService.resolveAlert(
                event.vehicle(),
                OperationalAlertType.COMMUNICATION_DELAY
        );

        alertService.resolveAlert(
                event.vehicle(),
                OperationalAlertType.NO_COMMUNICATION
        );

    }

}