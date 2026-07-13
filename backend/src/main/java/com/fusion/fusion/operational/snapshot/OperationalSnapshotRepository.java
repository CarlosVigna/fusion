package com.fusion.fusion.operational.snapshot;

import com.fusion.fusion.vehicle.Vehicle;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface OperationalSnapshotRepository
        extends JpaRepository<OperationalSnapshot, Long> {

    Optional<OperationalSnapshot> findFirstByVehicle(
            Vehicle vehicle
    );

    @Query("SELECT COUNT(s) FROM OperationalSnapshot s " +
           "JOIN s.vehicle v " +
           "WHERE v.deletedAt IS NULL " +
           "AND v.active = true")
    long countMonitored();

}