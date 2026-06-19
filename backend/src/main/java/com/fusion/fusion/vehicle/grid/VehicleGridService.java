package com.fusion.fusion.vehicle.grid;

import com.fusion.fusion.operational.snapshot.OperationalSnapshot;
import com.fusion.fusion.operational.snapshot.OperationalSnapshotRepository;
import com.fusion.fusion.vehicle.Vehicle;
import com.fusion.fusion.vehicle.VehicleRepository;
import com.fusion.fusion.vehicle.multiportal.linkage.DeviceLinkage;
import com.fusion.fusion.vehicle.multiportal.linkage.DeviceLinkageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class VehicleGridService {

    private final VehicleRepository vehicleRepository;

    private final DeviceLinkageRepository linkageRepository;

    private final OperationalSnapshotRepository
            snapshotRepository;

    public List<GridVehicleResponse> getGrid() {

        return vehicleRepository.findAll()
                .stream()
                .filter(vehicle ->
                        vehicle.getDeletedAt() == null
                )
                .map(this::buildGridResponse)
                .toList();

    }

    private GridVehicleResponse buildGridResponse(
            Vehicle vehicle
    ) {

        OperationalSnapshot snapshot =
                snapshotRepository.findByVehicle(vehicle)
                        .orElse(null);

        Optional<DeviceLinkage> activeLinkage =
                linkageRepository
                        .findByVehicle(vehicle)
                        .stream()
                        .filter(linkage ->
                                Boolean.TRUE.equals(
                                        linkage.getActive()
                                )
                        )
                        .findFirst();

        String activeDevice = null;
        String manufacturer = null;
        String model = null;
        String lineNumber = null;
        String operator = null;

        if (activeLinkage.isPresent()) {

            DeviceLinkage linkage =
                    activeLinkage.get();

            if (linkage.getDevice() != null) {

                activeDevice =
                        linkage.getDevice()
                                .getNumberStr();

                manufacturer =
                        linkage.getDevice()
                                .getManufacturer();

                model =
                        linkage.getDevice()
                                .getModel();

                lineNumber =
                        linkage.getDevice()
                                .getLineNumber();

                operator =
                        linkage.getDevice()
                                .getOperator();

            }

        }

        return new GridVehicleResponse(

                vehicle.getId(),

                vehicle.getPlate(),

                vehicle.getInsuredName(),

                vehicle.getPlatform(),

                snapshot != null
                        ? snapshot.getOnline()
                        : false,

                snapshot != null
                        ? snapshot.getBatteryLevel()
                        : null,

                snapshot != null
                        && snapshot.getLastCommunicationAt() != null
                        ? snapshot.getLastCommunicationAt()
                        .toLocalDate()
                        : null,

                snapshot != null
                        && snapshot.getLastCommunicationAt() != null
                        ? snapshot.getLastCommunicationAt()
                        .toLocalTime()
                        : null,

                vehicle.getInMaintenance(),

                vehicle.getMaintenanceOperator(),

                activeDevice,

                manufacturer,

                model,

                lineNumber,

                operator,

                snapshot != null
                        ? snapshot.getOperationalStatus()
                        : null,

                snapshot != null
                        ? snapshot.getCommunicationStatus()
                        : null,

                snapshot != null
                        ? snapshot.getSignalDelayMinutes()
                        : null,

                snapshot != null
                        ? snapshot.getStaleUpdate()
                        : false,

                snapshot != null
                        ? snapshot.getLowBattery()
                        : false

        );

    }

}