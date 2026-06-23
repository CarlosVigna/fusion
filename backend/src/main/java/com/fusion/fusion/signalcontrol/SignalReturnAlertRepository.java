package com.fusion.fusion.signalcontrol;

import com.fusion.fusion.vehicle.Vehicle;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SignalReturnAlertRepository
        extends JpaRepository<SignalReturnAlert, Long> {

    List<SignalReturnAlert> findByDismissedFalseOrderByDetectedAtDesc();

    Optional<SignalReturnAlert> findByVehicleAndDismissedFalse(
            Vehicle vehicle
    );

}
