package com.fusion.fusion.pendingchange;

import com.fusion.fusion.common.exception.BusinessException;
import com.fusion.fusion.common.exception.ResourceNotFoundException;
import com.fusion.fusion.vehicle.Vehicle;
import com.fusion.fusion.vehicle.VehicleRepository;
import com.fusion.fusion.vehicle.multiportal.device.Device;
import com.fusion.fusion.vehicle.multiportal.device.DeviceRepository;
import com.fusion.fusion.vehicle.multiportal.linkage.DeviceLinkage;
import com.fusion.fusion.vehicle.multiportal.linkage.DeviceLinkageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class PendingChangeService {

    private final PendingChangeRepository repository;
    private final VehicleRepository vehicleRepository;
    private final DeviceRepository deviceRepository;
    private final DeviceLinkageRepository linkageRepository;

    /**
     * Compara valor atual vs novo. Se for diferente e o valor atual já
     * existir (não é o primeiro preenchimento), registra uma mudança
     * pendente e retorna true — o chamador NÃO deve aplicar o newValue.
     * Se não houver diferença real (ou for primeiro preenchimento),
     * retorna false — o chamador aplica o valor normalmente.
     */
    public boolean detect(
            String vehiclePlate,
            String fieldName,
            String oldValue,
            String newValue,
            String sourceImport
    ) {

        if (Objects.equals(oldValue, newValue)) {
            return false;
        }

        if (oldValue == null || oldValue.isBlank()) {
            return false; // primeiro preenchimento, não é "mudança"
        }

        if (newValue == null || newValue.isBlank()) {
            return false; // planilha não trouxe valor novo, mantém o atual
        }

        Optional<PendingChange> existing =
                repository.findByVehiclePlateAndFieldNameAndStatus(
                        vehiclePlate,
                        fieldName,
                        PendingChangeStatus.PENDING
                );

        if (existing.isPresent()) {

            // já existe uma mudança pendente para esse campo; atualiza
            // o valor novo caso a planilha tenha mudado de novo
            PendingChange pending = existing.get();
            pending.setNewValue(newValue);
            repository.save(pending);

            return true;

        }

        PendingChange change = PendingChange.builder()
                .vehiclePlate(vehiclePlate)
                .fieldName(fieldName)
                .oldValue(oldValue)
                .newValue(newValue)
                .sourceImport(sourceImport)
                .status(PendingChangeStatus.PENDING)
                .build();

        repository.save(change);

        return true;

    }

    public List<PendingChange> findPending() {

        return repository.findByStatusOrderByDetectedAtDesc(
                PendingChangeStatus.PENDING
        );

    }

    public long countPending() {

        return repository.countByStatus(PendingChangeStatus.PENDING);

    }

    public void approve(Long id) {

        PendingChange change = findPendingById(id);

        applyChange(change);

        change.setStatus(PendingChangeStatus.APPROVED);
        change.setResolvedAt(LocalDateTime.now());
        change.setResolvedBy(currentUser());

        repository.save(change);

    }

    public void reject(Long id) {

        PendingChange change = findPendingById(id);

        change.setStatus(PendingChangeStatus.REJECTED);
        change.setResolvedAt(LocalDateTime.now());
        change.setResolvedBy(currentUser());

        repository.save(change);

    }

    private PendingChange findPendingById(Long id) {

        PendingChange change = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Mudança pendente não encontrada"
                ));

        if (!PendingChangeStatus.PENDING.equals(change.getStatus())) {
            throw new BusinessException(
                    "Mudança já foi resolvida"
            );
        }

        return change;

    }

    private void applyChange(PendingChange change) {

        Vehicle vehicle = vehicleRepository.findByPlate(
                change.getVehiclePlate()
        ).orElseThrow(() -> new ResourceNotFoundException(
                "Veículo não encontrado: " + change.getVehiclePlate()
        ));

        switch (change.getFieldName()) {

            case "insuredName" -> {
                vehicle.setInsuredName(change.getNewValue());
                vehicleRepository.save(vehicle);
            }

            case "operator", "lineNumber", "manufacturer", "model" ->
                    applyDeviceField(vehicle, change);

            case "dispositivo" -> applyDeviceSwap(vehicle, change);

            default -> throw new BusinessException(
                    "Campo não suportado para aprovação: "
                            + change.getFieldName()
            );

        }

    }

    private void applyDeviceField(
            Vehicle vehicle,
            PendingChange change
    ) {

        DeviceLinkage linkage =
                linkageRepository.findByVehicleAndActiveTrue(vehicle)
                        .orElseThrow(() -> new ResourceNotFoundException(
                                "Veículo sem dispositivo ativo vinculado"
                        ));

        Device device = linkage.getDevice();

        switch (change.getFieldName()) {
            case "operator" -> device.setOperator(change.getNewValue());
            case "lineNumber" -> device.setLineNumber(change.getNewValue());
            case "manufacturer" -> device.setManufacturer(change.getNewValue());
            case "model" -> device.setModel(change.getNewValue());
            default -> { }
        }

        deviceRepository.save(device);

    }

    private void applyDeviceSwap(
            Vehicle vehicle,
            PendingChange change
    ) {

        Device newDevice = deviceRepository
                .findByNumberStr(change.getNewValue())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Dispositivo não encontrado: " + change.getNewValue()
                ));

        linkageRepository.findByVehicleAndActiveTrue(vehicle)
                .ifPresent(current -> {
                    current.setActive(false);
                    linkageRepository.save(current);
                });

        newDevice.setVehicle(vehicle);
        deviceRepository.save(newDevice);

        DeviceLinkage newLinkage = DeviceLinkage.builder()
                .vehicle(vehicle)
                .device(newDevice)
                .manufacturer(newDevice.getManufacturer())
                .active(true)
                .build();

        linkageRepository.save(newLinkage);

    }

    private String currentUser() {

        var authentication = SecurityContextHolder.getContext()
                .getAuthentication();

        if (authentication == null
                || "anonymousUser".equals(authentication.getPrincipal())) {
            return null;
        }

        return authentication.getName();

    }

}
