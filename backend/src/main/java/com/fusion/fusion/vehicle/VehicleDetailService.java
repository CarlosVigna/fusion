package com.fusion.fusion.vehicle;

import com.fusion.fusion.common.exception.ResourceNotFoundException;
import com.fusion.fusion.letter.LetterRecordRepository;
import com.fusion.fusion.letter.LetterRecordResponse;
import com.fusion.fusion.maintenance.MaintenanceRecordRepository;
import com.fusion.fusion.maintenance.MaintenanceRecordResponse;
import com.fusion.fusion.maintenance.MaintenanceStatus;
import com.fusion.fusion.observation.VehicleObservationService;
import com.fusion.fusion.operational.snapshot.OperationalSnapshot;
import com.fusion.fusion.operational.snapshot.OperationalSnapshotRepository;
import com.fusion.fusion.vehicle.multiportal.linkage.DeviceLinkage;
import com.fusion.fusion.vehicle.multiportal.linkage.DeviceLinkageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class VehicleDetailService {

    private final VehicleRepository vehicleRepository;

    private final OperationalSnapshotRepository snapshotRepository;

    private final DeviceLinkageRepository linkageRepository;

    private final LetterRecordRepository letterRecordRepository;

    private final MaintenanceRecordRepository maintenanceRecordRepository;

    private final VehicleObservationService observationService;

    public VehicleDetailResponse findByPlate(String plate) {

        Vehicle vehicle = vehicleRepository
                .findByPlate(normalizePlate(plate))
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Veículo não encontrado"
                ));

        OperationalSnapshot snapshot = snapshotRepository
                .findFirstByVehicle(vehicle)
                .orElse(null);

        DeviceLinkage activeLinkage = linkageRepository
                .findByVehicleAndActiveTrue(vehicle)
                .orElse(null);

        LetterRecordResponse activeLetter = letterRecordRepository
                .findByVehicleAndDataRetornoSinal(vehicle, "Sem retorno.")
                .map(LetterRecordResponse::from)
                .orElse(null);

        var letterHistory = letterRecordRepository
                .findByVehicleOrderByDataEnvioDesc(vehicle)
                .stream()
                .map(LetterRecordResponse::from)
                .toList();

        MaintenanceRecordResponse activeMaintenance = maintenanceRecordRepository
                .findByVehicleAndStatus(vehicle, MaintenanceStatus.ABERTO)
                .map(MaintenanceRecordResponse::from)
                .orElse(null);

        var maintenanceHistory = maintenanceRecordRepository
                .findByVehicleOrderByDataDesc(vehicle)
                .stream()
                .map(MaintenanceRecordResponse::from)
                .toList();

        var observationHistory = observationService.findHistory(plate);

        return new VehicleDetailResponse(

                vehicle.getId(),
                vehicle.getPlate(),
                vehicle.getInsuredName(),
                vehicle.getPlatform(),
                vehicle.getPartnership(),
                vehicle.getPolicy(),
                vehicle.getBroker(),
                vehicle.getInMaintenance(),
                vehicle.getMaintenanceOperator(),

                snapshot != null ? snapshot.getOperationalStatus() : null,
                snapshot != null ? snapshot.getCommunicationStatus() : null,
                snapshot != null ? snapshot.getOnline() : null,
                snapshot != null ? snapshot.getBatteryLevel() : null,
                snapshot != null ? snapshot.getStaleUpdate() : null,
                snapshot != null ? snapshot.getLowBattery() : null,
                snapshot != null ? snapshot.getLastCommunicationAt() : null,
                snapshot != null ? snapshot.getSignalDelayMinutes() : null,

                activeLinkage != null && activeLinkage.getDevice() != null
                        ? activeLinkage.getDevice().getNumberStr() : null,
                activeLinkage != null && activeLinkage.getDevice() != null
                        ? activeLinkage.getDevice().getImei() : null,
                activeLinkage != null && activeLinkage.getDevice() != null
                        ? activeLinkage.getDevice().getManufacturer() : null,
                activeLinkage != null && activeLinkage.getDevice() != null
                        ? activeLinkage.getDevice().getModel() : null,
                activeLinkage != null && activeLinkage.getDevice() != null
                        ? activeLinkage.getDevice().getLineNumber() : null,
                activeLinkage != null && activeLinkage.getDevice() != null
                        ? activeLinkage.getDevice().getOperator() : null,

                activeLetter,
                letterHistory,

                activeMaintenance,
                maintenanceHistory,

                observationHistory.isEmpty() ? null : observationHistory.get(0)

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
