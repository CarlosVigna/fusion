package com.fusion.fusion.operational.detector;

import com.fusion.fusion.operational.event.StaleUpdateEvent;
import com.fusion.fusion.operational.rules.OperationalRulesProperties;
import com.fusion.fusion.vehicle.operational.VehicleOperationalState;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
public class StaleUpdateDetector
        implements OperationalDetector {

    private final OperationalRulesProperties
            properties;

    private final ApplicationEventPublisher
            publisher;

    @Override
    public void detect(
            VehicleOperationalState state
    ) {

        if (state.getLastCommunicationAt() == null) {
            return;
        }

        boolean stale =
                state.getLastCommunicationAt()
                        .isBefore(
                                LocalDateTime.now()
                                        .minusHours(
                                                properties.getStaleUpdateHours()
                                        )
                        );

        if (!stale) {
            return;
        }

        publisher.publishEvent(
                new StaleUpdateEvent(
                        state.getVehicle(),
                        "Atualização obsoleta detectada"
                )
        );

    }

}