package com.fusion.fusion.vehicle.multiportal.operational;

import com.fusion.fusion.vehicle.Vehicle;
import com.fusion.fusion.vehicle.VehicleRepository;
import com.fusion.fusion.vehicle.operational.CommunicationStatus;
import com.fusion.fusion.vehicle.operational.VehicleOperationalState;
import com.fusion.fusion.vehicle.operational.VehicleOperationalStateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class MultiportalOperationalService {

    private final VehicleRepository repository;

    private final VehicleOperationalStateRepository
            operationalRepository;

    private final OperationalParserService parserService;

    public OperationalUpdateResponse update(
            OperationalUpdateRequest request
    ) {

        List<VehicleOperationalData> operationalVehicles =
                parserService.parse(request.rawContent());

        int updated = 0;

        List<String> notFound = new ArrayList<>();

        for (VehicleOperationalData operational :
                operationalVehicles) {

            Optional<Vehicle> optionalVehicle =
                    repository.findByPlate(
                            normalizePlate(
                                    operational.getPlate()
                            )
                    );

            if (optionalVehicle.isEmpty()) {

                notFound.add(operational.getPlate());

                continue;

            }

            Vehicle vehicle =
                    optionalVehicle.get();

            Optional<VehicleOperationalState>
                    optionalState =
                    operationalRepository.findByVehicle(
                            vehicle
                    );

            VehicleOperationalState state;

            if (optionalState.isPresent()) {

                state = optionalState.get();

            } else {

                state = VehicleOperationalState.builder()
                        .vehicle(vehicle)
                        .build();

            }

            state.setBatteryLevel(
                    operational.getBatteryLevel()
            );

            state.setLastCommunicationAt(
                    operational.getLastUpdateAt()
            );

            state.setLastPositionAt(
                    operational.getLastUpdateAt()
            );

            state.setOnline(true);

            state.setCommunicationStatus(
                    CommunicationStatus.ONLINE
            );

            state.setUpdatedAt(
                    LocalDateTime.now()
            );

            operationalRepository.save(state);

            updated++;

        }

        return new OperationalUpdateResponse(
                updated,
                notFound.size(),
                notFound
        );

    }

    private String normalizePlate(String plate) {

        return plate
                .replace("-", "")
                .replace(" ", "")
                .trim()
                .toUpperCase();

    }

}