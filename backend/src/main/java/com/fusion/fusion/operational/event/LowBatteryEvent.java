package com.fusion.fusion.operational.event;

import com.fusion.fusion.vehicle.Vehicle;

public record LowBatteryEvent(

        Vehicle vehicle,

        String description

) implements OperationalEvent {
}