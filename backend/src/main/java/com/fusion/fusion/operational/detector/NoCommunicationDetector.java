package com.fusion.fusion.operational.detector;

import com.fusion.fusion.operational.event.CommunicationLostEvent;
import com.fusion.fusion.vehicle.operational.CommunicationStatus;
import com.fusion.fusion.vehicle.operational.VehicleOperationalState;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class NoCommunicationDetector
        implements OperationalDetector {

    private final ApplicationEventPublisher publisher;

    @Override
    public void detect(
            VehicleOperationalState state
    ) {

        if (state.getCommunicationStatus()
                != CommunicationStatus.NO_COMMUNICATION) {

            return;

        }

        publisher.publishEvent(
                new CommunicationLostEvent(
                        state.getVehicle(),
                        "Veículo sem comunicação"
                )
        );

    }

}