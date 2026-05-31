package com.fusion.fusion.operational.detector;

import com.fusion.fusion.vehicle.operational.VehicleOperationalState;

public interface OperationalDetector {

    void detect(
            VehicleOperationalState state
    );

}