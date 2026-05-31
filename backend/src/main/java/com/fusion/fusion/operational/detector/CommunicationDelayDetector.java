package com.fusion.fusion.operational.detector;

import com.fusion.fusion.operational.event.CommunicationDelayedEvent;
import com.fusion.fusion.vehicle.operational.CommunicationStatus;
import com.fusion.fusion.vehicle.operational.VehicleOperationalState;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class CommunicationDelayDetector
        implements OperationalDetector {

    private final ApplicationEventPublisher publisher;

    @Override
    public void detect(
            VehicleOperationalState state
    ) {

        if (state.getCommunicationStatus()
                != CommunicationStatus.DELAYED) {

            return;

        }

        publisher.publishEvent(
                new CommunicationDelayedEvent(
                        state.getVehicle(),
                        "Veículo com comunicação atrasada"
                )
        );

    }

}