package com.fusion.fusion.vehicle.portal;

import com.fusion.fusion.vehicle.Vehicle;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface VehiclePortalDiffRepository extends JpaRepository<VehiclePortalDiff, Long> {

    List<VehiclePortalDiff> findByAcceptedAtIsNullAndRejectedAtIsNullOrderByDetectedAtDesc();

    Optional<VehiclePortalDiff> findByVehicleAndFieldAndNewValueAndAcceptedAtIsNullAndRejectedAtIsNull(
            Vehicle vehicle,
            String field,
            String newValue
    );

}
