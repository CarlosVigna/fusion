package com.fusion.fusion.operational.detector;

import com.fusion.fusion.operational.event.LowBatteryEvent;
import com.fusion.fusion.operational.rules.OperationalRulesService;
import com.fusion.fusion.vehicle.operational.VehicleOperationalState;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class LowBatteryDetector
        implements OperationalDetector {

    private final OperationalRulesService
            rulesService;

    private final ApplicationEventPublisher
            publisher;

    @Override
    public void detect(
            VehicleOperationalState state
    ) {

        if (!rulesService.isLowBattery(
                state.getBatteryLevel()
        )) {

            return;

        }

        publisher.publishEvent(
                new LowBatteryEvent(
                        state.getVehicle(),
                        "Bateria baixa detectada"
                )
        );

    }

}