package com.fusion.fusion.serviceorder;

import com.fusion.fusion.vehicle.Vehicle;
import com.fusion.fusion.vehicle.VehicleRepository;
import com.fusion.fusion.vehicle.multiportal.linkage.DeviceLinkage;
import com.fusion.fusion.vehicle.multiportal.linkage.DeviceLinkageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Component
@RequiredArgsConstructor
public class ServiceOrderCompletionScheduler {

    private final ServiceOrderService serviceOrderService;
    private final VehicleRepository vehicleRepository;
    private final DeviceLinkageRepository linkageRepository;

    @Scheduled(cron = "0 0 * * * *")
    public void checkInstallationCompletions() {

        List<ServiceOrder> pending = serviceOrderService.findPendingInstallations();
        if (pending.isEmpty()) return;

        Set<UUID> linkedVehicleIds = linkageRepository.findAllActiveWithVehicleAndDevice().stream()
                .filter(l -> l.getVehicle() != null)
                .map(l -> l.getVehicle().getId())
                .collect(Collectors.toSet());

        for (ServiceOrder so : pending) {
            if (so.getPlate() == null) continue;

            Optional<Vehicle> vehicleOpt = vehicleRepository.findByPlate(so.getPlate());
            if (vehicleOpt.isEmpty()) continue;

            Vehicle v = vehicleOpt.get();
            boolean active       = Boolean.TRUE.equals(v.getActive()) && v.getDeletedAt() == null;
            boolean communicated = Boolean.TRUE.equals(v.getHasEverCommunicated());
            boolean linked       = linkedVehicleIds.contains(v.getId());

            if (active && communicated && linked && !Boolean.TRUE.equals(so.getCompletionAlertSent())) {
                serviceOrderService.markCompletionAlertSent(so.getId());
                log.info("[OS-SCHEDULER] Alerta de conclusão criado para OS {} placa {}", so.getId(), so.getPlate());
            }
        }
    }
}
