package com.fusion.fusion.operational.event;

import com.fusion.fusion.vehicle.Vehicle;

public record CommunicationDelayedEvent(

        Vehicle vehicle,

        String description

) implements OperationalEvent {
}