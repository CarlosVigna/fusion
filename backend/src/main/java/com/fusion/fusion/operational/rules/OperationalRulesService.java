package com.fusion.fusion.operational.rules;

import com.fusion.fusion.vehicle.operational.CommunicationStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class OperationalRulesService {

    private final OperationalRulesProperties
            properties;

    public CommunicationStatus resolveCommunicationStatus(
            long delayMinutes
    ) {

        if (delayMinutes
                <= properties.getDelayedMinutes()) {

            return CommunicationStatus.ONLINE;

        }

        if (delayMinutes
                <= properties.getNoCommunicationMinutes()) {

            return CommunicationStatus.DELAYED;

        }

        return CommunicationStatus.NO_COMMUNICATION;

    }

    public boolean isLowBattery(
            Integer batteryLevel
    ) {

        if (batteryLevel == null) {
            return false;
        }

        return batteryLevel
                <= properties.getLowBatteryLevel();

    }

}