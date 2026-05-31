package com.fusion.fusion.vehicle;

import com.fusion.fusion.audit.AuditAction;
import com.fusion.fusion.audit.AuditService;
import com.fusion.fusion.common.exception.BusinessException;
import com.fusion.fusion.common.exception.ResourceNotFoundException;

import lombok.RequiredArgsConstructor;

import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class VehicleService {

    private final AuditService auditService;

    private final VehicleRepository repository;

    public VehicleResponse create(
            VehicleRequest request
    ) {

        repository.findByPlate(
                        normalizePlate(
                                request.plate()
                        )
                )
                .ifPresent(vehicle -> {

                    throw new BusinessException(
                            "Já existe veículo com essa placa"
                    );

                });

        Vehicle vehicle =
                Vehicle.builder()

                        .plate(
                                normalizePlate(
                                        request.plate()
                                )
                        )

                        .insuredName(
                                request.insuredName()
                        )

                        .platform(
                                request.platform()
                        )

                        .partnership(
                                request.partnership()
                        )

                        .policy(
                                request.policy()
                        )

                        .broker(
                                request.broker()
                        )

                        .notes(
                                request.notes()
                        )

                        .build();

        repository.save(vehicle);

        return mapToResponse(vehicle);

    }

    public List<VehicleResponse> findAll() {

        return repository.findAll()
                .stream()

                .filter(vehicle ->
                        vehicle.getDeletedAt() == null
                )

                .map(this::mapToResponse)

                .toList();

    }

    public VehicleResponse findByPlate(
            String plate
    ) {

        Vehicle vehicle =
                repository.findByPlate(
                                normalizePlate(plate)
                        )

                        .orElseThrow(() ->

                                new ResourceNotFoundException(
                                        "Veículo não encontrado"
                                )
                        );

        return mapToResponse(vehicle);

    }

    private VehicleResponse mapToResponse(
            Vehicle vehicle
    ) {

        return new VehicleResponse(

                vehicle.getId(),

                vehicle.getPlate(),

                vehicle.getInsuredName(),

                vehicle.getPlatform(),

                vehicle.getPartnership(),

                vehicle.getPolicy(),

                vehicle.getBroker(),

                vehicle.getInMaintenance(),

                null,

                null,

                null

        );

    }
    private String normalizePlate(
            String plate
    ) {

        return plate

                .replace("-", "")

                .replace(" ", "")

                .trim()

                .toUpperCase();

    }

    public VehicleResponse update(

            String plate,

            VehicleUpdateRequest request

    ) {

        Vehicle vehicle =
                repository.findByPlate(
                                normalizePlate(plate)
                        )

                        .orElseThrow(() ->

                                new ResourceNotFoundException(
                                        "Veículo não encontrado"
                                )
                        );

        if (!equals(
                vehicle.getInsuredName(),
                request.insuredName()
        )) {

            auditService.log(

                    vehicle,

                    AuditAction.UPDATE,

                    "insuredName",

                    vehicle.getInsuredName(),

                    request.insuredName()

            );

            vehicle.setInsuredName(
                    request.insuredName()
            );

        }

        if (!equals(
                vehicle.getNotes(),
                request.notes()
        )) {

            auditService.log(

                    vehicle,

                    AuditAction.UPDATE,

                    "notes",

                    vehicle.getNotes(),

                    request.notes()

            );

            vehicle.setNotes(
                    request.notes()
            );

        }

        if (!equals(

                vehicle.getInMaintenance(),

                request.inMaintenance()

        )) {

            auditService.log(

                    vehicle,

                    AuditAction.MAINTENANCE_UPDATE,

                    "inMaintenance",

                    String.valueOf(
                            vehicle.getInMaintenance()
                    ),

                    String.valueOf(
                            request.inMaintenance()
                    )

            );

            vehicle.setInMaintenance(
                    request.inMaintenance()
            );

        }

        vehicle.setMaintenanceNotes(
                request.maintenanceNotes()
        );

        vehicle.setMaintenanceOperator(
                request.maintenanceOperator()
        );

        vehicle.setPlatform(
                request.platform()
        );

        vehicle.setPartnership(
                request.partnership()
        );

        vehicle.setPolicy(
                request.policy()
        );

        vehicle.setBroker(
                request.broker()
        );

        repository.save(vehicle);

        return mapToResponse(vehicle);

    }

    private boolean equals(
            Object a,
            Object b
    ) {

        if (a == null && b == null) {
            return true;
        }

        if (a == null || b == null) {
            return false;
        }

        return a.equals(b);

    }

    public void delete(
            String plate
    ) {

        Vehicle vehicle =
                repository.findByPlate(
                                normalizePlate(plate)
                        )

                        .orElseThrow(() ->

                                new ResourceNotFoundException(
                                        "Veículo não encontrado"
                                )
                        );

        vehicle.setDeletedAt(
                java.time.LocalDateTime.now()
        );

        repository.save(vehicle);

    }

}