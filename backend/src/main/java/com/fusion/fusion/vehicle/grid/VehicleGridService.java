package com.fusion.fusion.vehicle.grid;

import com.fusion.fusion.observation.VehicleObservation;
import com.fusion.fusion.observation.VehicleObservationService;
import com.fusion.fusion.operational.snapshot.OperationalSnapshot;
import com.fusion.fusion.operational.snapshot.OperationalSnapshotRepository;
import com.fusion.fusion.vehicle.Vehicle;
import com.fusion.fusion.vehicle.VehicleRepository;
import com.fusion.fusion.vehicle.multiportal.linkage.DeviceLinkage;
import com.fusion.fusion.vehicle.multiportal.linkage.DeviceLinkageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class VehicleGridService {

    private final VehicleRepository vehicleRepository;

    private final DeviceLinkageRepository linkageRepository;

    private final OperationalSnapshotRepository
            snapshotRepository;

    private final VehicleObservationService
            observationService;

    public List<GridVehicleResponse> getGrid() {

        // Pre-carrega tudo de uma vez em vez de 2 queries por veículo
        // (era o N+1 que fazia /vehicles/grid demorar ~20s para 245+
        // veículos).
        Map<UUID, OperationalSnapshot> snapshotsByVehicleId =
                new HashMap<>();

        for (OperationalSnapshot snapshot : snapshotRepository.findAll()) {

            if (snapshot.getVehicle() != null) {
                snapshotsByVehicleId.put(
                        snapshot.getVehicle().getId(),
                        snapshot
                );
            }

        }

        Map<UUID, DeviceLinkage> activeLinkageByVehicleId =
                new HashMap<>();

        for (DeviceLinkage linkage :
                linkageRepository.findAllActiveWithVehicleAndDevice()) {

            if (linkage.getVehicle() != null) {

                activeLinkageByVehicleId.putIfAbsent(
                        linkage.getVehicle().getId(),
                        linkage
                );

            }

        }

        // Grid mostra apenas veiculos que ja apareceram pelo menos uma vez
        // numa planilha de Ultima Posicao com posicao preenchida e que
        // ainda tem vinculo de equipamento ativo. Veiculos com vinculo mas
        // que nunca comunicaram ficam na aba Monitoramento ("nunca
        // comunicou"), nao aqui — eles nao tem nada de "atraso" a mostrar.
        List<Vehicle> vehicles = vehicleRepository.findAll()
                .stream()
                .filter(vehicle ->
                        vehicle.getDeletedAt() == null
                                && Boolean.TRUE.equals(
                                vehicle.getHasEverCommunicated()
                        )
                                && activeLinkageByVehicleId.containsKey(
                                vehicle.getId()
                        )
                )
                .toList();

        Map<UUID, VehicleObservation> latestObservationByVehicleId =
                observationService.findLatestByVehicleId();

        return vehicles.stream()
                .map(vehicle -> buildGridResponse(
                        vehicle,
                        snapshotsByVehicleId.get(vehicle.getId()),
                        activeLinkageByVehicleId.get(vehicle.getId()),
                        latestObservationByVehicleId.get(vehicle.getId())
                ))
                .toList();

    }

    private GridVehicleResponse buildGridResponse(
            Vehicle vehicle,
            OperationalSnapshot snapshot,
            DeviceLinkage activeLinkage,
            VehicleObservation lastObservation
    ) {

        String activeDevice = null;
        String manufacturer = null;
        String model = null;
        String lineNumber = null;
        String operator = null;

        if (activeLinkage != null
                && activeLinkage.getDevice() != null) {

            activeDevice =
                    activeLinkage.getDevice()
                            .getNumberStr();

            manufacturer =
                    activeLinkage.getDevice()
                            .getManufacturer();

            model =
                    activeLinkage.getDevice()
                            .getModel();

            lineNumber =
                    activeLinkage.getDevice()
                            .getLineNumber();

            operator =
                    activeLinkage.getDevice()
                            .getOperator();

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
                        ? snapshot.getLastCommunicationAt()
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
                        : false,

                lastObservation != null
                        ? lastObservation.getText()
                        : null,

                lastObservation != null
                        ? lastObservation.getCreatedAt()
                        : null

        );

    }

}
