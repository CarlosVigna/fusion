package com.fusion.fusion.vehicle.multiportal.linkage;

import com.fusion.fusion.vehicle.Vehicle;
import com.fusion.fusion.vehicle.multiportal.device.Device;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DeviceLinkageRepository
        extends JpaRepository<DeviceLinkage, UUID> {

    List<DeviceLinkage> findByVehicle(Vehicle vehicle);

    Optional<DeviceLinkage> findByVehicleAndActiveTrue(
            Vehicle vehicle
    );

    Optional<DeviceLinkage> findByVehicleAndDeviceAndActiveTrue(
            Vehicle vehicle,
            Device device
    );

    // findAll() comum dispara 1 query extra por linha para resolver as
    // associacoes @ManyToOne (vehicle, device) — N+1 que ficava mascarado
    // sob baixa contencao mas trava o /vehicles/grid sob carga. JOIN
    // FETCH resolve tudo numa unica query.
    @Query(
            "SELECT dl FROM DeviceLinkage dl "
                    + "LEFT JOIN FETCH dl.vehicle "
                    + "LEFT JOIN FETCH dl.device "
                    + "WHERE dl.active = true"
    )
    List<DeviceLinkage> findAllActiveWithVehicleAndDevice();

}