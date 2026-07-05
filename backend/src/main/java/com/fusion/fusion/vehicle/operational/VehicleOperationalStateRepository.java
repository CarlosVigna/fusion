package com.fusion.fusion.vehicle.operational;

import com.fusion.fusion.vehicle.Vehicle;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface VehicleOperationalStateRepository
        extends JpaRepository<VehicleOperationalState, Long> {

    Optional<VehicleOperationalState> findByVehicle(
            Vehicle vehicle
    );

    long countBySignalDelayMinutesGreaterThan(Integer minutes);

    @Query("SELECT vos FROM VehicleOperationalState vos " +
           "JOIN FETCH vos.vehicle " +
           "WHERE vos.vehicle.deletedAt IS NULL")
    List<VehicleOperationalState> findAllWithVehicle();

}
