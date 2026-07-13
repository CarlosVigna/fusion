package com.fusion.fusion.vehicle.operational;

import com.fusion.fusion.vehicle.Vehicle;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface VehicleOperationalStateRepository
        extends JpaRepository<VehicleOperationalState, Long> {

    Optional<VehicleOperationalState> findFirstByVehicle(
            Vehicle vehicle
    );

    long countBySignalDelayMinutesGreaterThan(Integer minutes);

    @Query("SELECT COUNT(vos) FROM VehicleOperationalState vos " +
           "JOIN vos.vehicle v " +
           "WHERE v.deletedAt IS NULL " +
           "AND v.hasEverCommunicated = true " +
           "AND vos.signalDelayMinutes > :threshold")
    long countDelayedSignal(@Param("threshold") int threshold);

    @Query("SELECT vos FROM VehicleOperationalState vos " +
           "JOIN FETCH vos.vehicle " +
           "WHERE vos.vehicle.deletedAt IS NULL")
    List<VehicleOperationalState> findAllWithVehicle();

}
