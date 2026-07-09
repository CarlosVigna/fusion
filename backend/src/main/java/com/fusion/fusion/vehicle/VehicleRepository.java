package com.fusion.fusion.vehicle;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface VehicleRepository extends JpaRepository<Vehicle, UUID> {

    Optional<Vehicle> findByPlate(String plate);

    long countByDeletedAtIsNull();

    List<Vehicle> findByVehicleGroup(VehicleGroup vehicleGroup);

}