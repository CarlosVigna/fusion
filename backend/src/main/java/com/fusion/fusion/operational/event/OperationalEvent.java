package com.fusion.fusion.operational.event;

import com.fusion.fusion.vehicle.Vehicle;

public interface OperationalEvent {

    Vehicle vehicle();

    String description();

}