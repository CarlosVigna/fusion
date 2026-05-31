package com.fusion.fusion.vehicle.operational;

import com.fusion.fusion.vehicle.Vehicle;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface VehicleOperationalStateRepository
        extends JpaRepository<VehicleOperationalState, Long> {

    Optional<VehicleOperationalState> findByVehicle(
            Vehicle vehicle
    );

}