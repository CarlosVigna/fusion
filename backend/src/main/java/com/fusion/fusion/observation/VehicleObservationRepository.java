package com.fusion.fusion.observation;

import com.fusion.fusion.vehicle.Vehicle;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface VehicleObservationRepository
        extends JpaRepository<VehicleObservation, Long> {

    List<VehicleObservation> findByVehicleOrderByCreatedAtDesc(
            Vehicle vehicle
    );

    // Carrega tudo ordenado de uma vez em vez de 1 query por veiculo —
    // quem chama pega o primeiro de cada vehicle_id (lista ja vem
    // ordenada por createdAt desc).
    List<VehicleObservation> findAllByOrderByCreatedAtDesc();

}
