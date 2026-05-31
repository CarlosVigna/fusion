package com.fusion.fusion.alert;

import com.fusion.fusion.vehicle.Vehicle;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface OperationalAlertRepository
        extends JpaRepository<OperationalAlert, Long> {

    Optional<OperationalAlert> findByVehicleAndTypeAndStatus(
            Vehicle vehicle,
            OperationalAlertType type,
            OperationalAlertStatus status
    );

}