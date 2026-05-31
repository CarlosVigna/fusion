package com.fusion.fusion.vehicle.multiportal.device;

import com.fusion.fusion.importation.confirm.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class DeviceConfirmService {

    private final DeviceRepository repository;

    public ImportConfirmResponse confirm(
            ImportConfirmRequest request
    ) {

        int updated = 0;
        int created = 0;

        for (ImportConfirmItem item :
                request.items()) {

            Optional<Device> optionalDevice =
                    repository.findByImei(
                            item.identifier()
                    );

            if (item.action().equalsIgnoreCase(
                    "CREATE"
            )) {

                if (optionalDevice.isPresent()) {
                    continue;
                }

                Device device =
                        Device.builder()
                                .imei(item.identifier())
                                .build();

                repository.save(device);

                created++;

                continue;

            }

            if (item.action().equalsIgnoreCase(
                    "UPDATE"
            )) {

                if (optionalDevice.isEmpty()) {
                    continue;
                }

                Device device =
                        optionalDevice.get();

                updated++;

                repository.save(device);

            }

        }

        return new ImportConfirmResponse(
                updated,
                created
        );

    }

}