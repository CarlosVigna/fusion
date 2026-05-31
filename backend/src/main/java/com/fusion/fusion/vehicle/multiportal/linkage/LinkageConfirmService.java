package com.fusion.fusion.vehicle.multiportal.linkage;

import com.fusion.fusion.importation.confirm.*;
import com.fusion.fusion.vehicle.Vehicle;
import com.fusion.fusion.vehicle.VehicleRepository;
import com.fusion.fusion.vehicle.multiportal.device.Device;
import com.fusion.fusion.vehicle.multiportal.device.DeviceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class LinkageConfirmService {

    private final DeviceLinkageRepository repository;
    private final VehicleRepository vehicleRepository;
    private final DeviceRepository deviceRepository;

    public ImportConfirmResponse confirm(
            ImportConfirmRequest request
    ) {

        int updated = 0;
        int created = 0;

        for (ImportConfirmItem item :
                request.items()) {

            Optional<Vehicle> optionalVehicle =
                    vehicleRepository.findByPlate(
                            item.identifier()
                    );

            if (optionalVehicle.isEmpty()) {
                continue;
            }

            Vehicle vehicle =
                    optionalVehicle.get();

            Optional<DeviceLinkage> activeLinkage =
                    repository.findByVehicleAndActiveTrue(
                            vehicle
                    );

            if (item.action().equalsIgnoreCase(
                    "CREATE"
            )) {

                if (activeLinkage.isPresent()) {
                    continue;
                }

                DeviceLinkage linkage =
                        DeviceLinkage.builder()
                                .vehicle(vehicle)
                                .active(true)
                                .build();

                repository.save(linkage);

                created++;

                continue;

            }

            if (item.action().equalsIgnoreCase(
                    "UPDATE"
            )) {

                if (activeLinkage.isEmpty()) {
                    continue;
                }

                DeviceLinkage linkage =
                        activeLinkage.get();

                updated++;

                repository.save(linkage);

            }

        }

        return new ImportConfirmResponse(
                updated,
                created
        );

    }

}