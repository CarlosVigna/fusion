package com.fusion.fusion.operational.event;

import com.fusion.fusion.vehicle.Vehicle;

public record CommunicationLostEvent(

        Vehicle vehicle,

        String description

) implements OperationalEvent {
}