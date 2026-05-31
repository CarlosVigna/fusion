package com.fusion.fusion.vehicle.tracknme;

import com.fusion.fusion.importation.confirm.*;
import com.fusion.fusion.vehicle.Vehicle;
import com.fusion.fusion.vehicle.VehiclePlatform;
import com.fusion.fusion.vehicle.VehicleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class TracknMeConfirmService {

    private final VehicleRepository repository;

    public ImportConfirmResponse confirm(
            ImportConfirmRequest request
    ) {

        int updated = 0;
        int created = 0;

        for (ImportConfirmItem item :
                request.items()) {

            Optional<Vehicle> optionalVehicle =
                    repository.findByPlate(
                            item.identifier()
                    );

            if (item.action().equalsIgnoreCase(
                    "CREATE"
            )) {

                if (optionalVehicle.isPresent()) {
                    continue;
                }

                Vehicle vehicle =
                        Vehicle.builder()
                                .plate(item.identifier())
                                .platform(
                                        VehiclePlatform.TRACKNME
                                )
                                .build();

                repository.save(vehicle);

                created++;

                continue;

            }

            if (item.action().equalsIgnoreCase(
                    "UPDATE"
            )) {

                if (optionalVehicle.isEmpty()) {
                    continue;
                }

                Vehicle vehicle =
                        optionalVehicle.get();

                updated++;

                repository.save(vehicle);

            }

        }

        return new ImportConfirmResponse(
                updated,
                created
        );

    }

}