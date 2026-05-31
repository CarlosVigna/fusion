package com.fusion.fusion.operational.snapshot;

import com.fusion.fusion.vehicle.Vehicle;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface OperationalSnapshotRepository
        extends JpaRepository<OperationalSnapshot, Long> {

    Optional<OperationalSnapshot> findByVehicle(
            Vehicle vehicle
    );

}