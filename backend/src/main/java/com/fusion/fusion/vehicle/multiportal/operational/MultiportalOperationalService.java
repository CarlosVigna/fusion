package com.fusion.fusion.vehicle.multiportal.operational;

import com.fusion.fusion.importation.ImportHistoryService;
import com.fusion.fusion.importation.ImportType;
import com.fusion.fusion.vehicle.PlateNormalizer;
import com.fusion.fusion.vehicle.PlateValidator;
import com.fusion.fusion.vehicle.Vehicle;
import com.fusion.fusion.vehicle.VehicleRepository;
import com.fusion.fusion.vehicle.operational.CommunicationStatus;
import com.fusion.fusion.vehicle.operational.VehicleOperationalState;
import com.fusion.fusion.vehicle.operational.VehicleOperationalStateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
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

    private final ImportHistoryService importHistoryService;

    public OperationalUpdateResponse update(
            OperationalUpdateRequest request
    ) {

        List<VehicleOperationalData> operationalVehicles =
                parserService.parse(request.rawContent());

        int updated = 0;

        List<String> notFound = new ArrayList<>();

        for (VehicleOperationalData operational :
                operationalVehicles) {

            String plate =
                    PlateNormalizer.normalize(operational.getPlate());

            if (!PlateValidator.isValidPlate(plate)) {
                continue;
            }

            Optional<Vehicle> optionalVehicle =
                    repository.findByPlate(plate);

            if (optionalVehicle.isEmpty()) {

                notFound.add(operational.getPlate());

                continue;

            }

            Vehicle vehicle =
                    optionalVehicle.get();

            if (operational.getInsuredName() != null
                    && !operational.getInsuredName().isBlank()
                    && !operational.getInsuredName().equals(
                            vehicle.getInsuredName()
                    )) {

                vehicle.setInsuredName(
                        operational.getInsuredName()
                );

                repository.save(vehicle);

            }

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
                    LocalDateTime.now(ZoneOffset.UTC)
            );

            operationalRepository.save(state);

            updated++;

        }

        importHistoryService.register(
                ImportType.MULTIPORTAL_OPERATIONAL,
                "paste-" + LocalDateTime.now(ZoneOffset.UTC),
                updated
        );

        return new OperationalUpdateResponse(
                updated,
                notFound.size(),
                notFound
        );

    }

}