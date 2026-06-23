package com.fusion.fusion.observation;

import com.fusion.fusion.common.exception.ResourceNotFoundException;
import com.fusion.fusion.common.security.CurrentUserService;
import com.fusion.fusion.vehicle.Vehicle;
import com.fusion.fusion.vehicle.VehicleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class VehicleObservationService {

    private final VehicleObservationRepository repository;

    private final VehicleRepository vehicleRepository;

    private final CurrentUserService currentUserService;

    public List<VehicleObservationResponse> findHistory(
            String plate
    ) {

        Vehicle vehicle = findVehicle(plate);

        return repository.findByVehicleOrderByCreatedAtDesc(vehicle)
                .stream()
                .map(VehicleObservationResponse::from)
                .toList();

    }

    @Transactional
    public VehicleObservationResponse create(
            String plate,
            String text
    ) {

        Vehicle vehicle = findVehicle(plate);

        VehicleObservation observation = VehicleObservation.builder()
                .vehicle(vehicle)
                .text(text)
                .createdBy(currentUserService.getCurrentUserName())
                .build();

        repository.save(observation);

        return VehicleObservationResponse.from(observation);

    }

    @Transactional
    public void check(Long id) {

        VehicleObservation observation = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Observação não encontrada"
                ));

        observation.setCheckedOff(true);

        observation.setCheckedAt(LocalDateTime.now());

        observation.setCheckedBy(
                currentUserService.getCurrentUserName()
        );

        repository.save(observation);

    }

    // Uma unica query ordenada em vez de 1 findByVehicle por veiculo —
    // usado pelo Grid e pelo Controle de Sinais para resolver a "ultima
    // observacao" de cada veiculo sem N+1.
    public Map<UUID, VehicleObservation> findLatestByVehicleId() {

        Map<UUID, VehicleObservation> latest = new HashMap<>();

        for (VehicleObservation observation :
                repository.findAllByOrderByCreatedAtDesc()) {

            if (observation.getVehicle() != null) {

                latest.putIfAbsent(
                        observation.getVehicle().getId(),
                        observation
                );

            }

        }

        return latest;

    }

    public Map<String, VehicleObservationResponse> findLatestResponses() {

        Map<String, VehicleObservationResponse> result =
                new HashMap<>();

        for (VehicleObservation observation :
                findLatestByVehicleId().values()) {

            result.put(
                    observation.getVehicle().getPlate(),
                    VehicleObservationResponse.from(observation)
            );

        }

        return result;

    }

    private Vehicle findVehicle(String plate) {

        return vehicleRepository.findByPlate(plate)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Veículo não encontrado"
                ));

    }

}
