package com.fusion.fusion.maintenance;

import com.fusion.fusion.vehicle.Vehicle;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MaintenanceRecordRepository
        extends JpaRepository<MaintenanceRecord, Long> {

    List<MaintenanceRecord> findAllByOrderByDataDesc();

    List<MaintenanceRecord> findByStatusOrderByDataDesc(
            MaintenanceStatus status
    );

    Optional<MaintenanceRecord> findByVehicleAndStatus(
            Vehicle vehicle,
            MaintenanceStatus status
    );

}
