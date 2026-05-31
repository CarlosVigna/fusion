package com.fusion.fusion.vehicle.multiportal.linkage;

import com.fusion.fusion.vehicle.Vehicle;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DeviceLinkageRepository
        extends JpaRepository<DeviceLinkage, UUID> {

    List<DeviceLinkage> findByVehicle(Vehicle vehicle);

    Optional<DeviceLinkage> findByVehicleAndActiveTrue(
            Vehicle vehicle
    );

}