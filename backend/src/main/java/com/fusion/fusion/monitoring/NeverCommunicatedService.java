package com.fusion.fusion.monitoring;

import com.fusion.fusion.vehicle.Vehicle;
import com.fusion.fusion.vehicle.VehicleRepository;
import com.fusion.fusion.vehicle.multiportal.linkage.DeviceLinkage;
import com.fusion.fusion.vehicle.multiportal.linkage.DeviceLinkageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class NeverCommunicatedService {

    // Sem coluna de status do dispositivo ainda — o diagnostico e
    // inferido apenas pelo tempo de vinculo (ver decisao do usuario:
    // < 7 dias = recem instalado, > 7 dias = falha de comunicacao).
    private static final int RECENTLY_INSTALLED_DAYS = 7;

    private final VehicleRepository vehicleRepository;

    private final DeviceLinkageRepository linkageRepository;

    public List<NeverCommunicatedResponse> findAll() {

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

        List<NeverCommunicatedResponse> result = new ArrayList<>();

        for (Vehicle vehicle : vehicleRepository.findAll()) {

            if (vehicle.getDeletedAt() != null
                    || Boolean.TRUE.equals(
                    vehicle.getHasEverCommunicated()
            )) {

                continue;

            }

            DeviceLinkage linkage =
                    activeLinkageByVehicleId.get(vehicle.getId());

            if (linkage == null) {
                continue; // sem vinculo ativo — nem candidato a "nunca comunicou"
            }

            result.add(build(vehicle, linkage));

        }

        return result;

    }

    private NeverCommunicatedResponse build(
            Vehicle vehicle,
            DeviceLinkage linkage
    ) {

        long daysLinked =
                linkage.getStartAt() != null
                        ? Duration.between(
                        linkage.getStartAt(),
                        LocalDateTime.now(ZoneOffset.UTC)
                ).toDays()
                        : 0;

        String diagnosis;
        String suggestedAction;

        if (daysLinked < RECENTLY_INSTALLED_DAYS) {

            diagnosis = "Recém instalado";

            suggestedAction = "Aguardar comunicação (24-48h)";

        } else {

            diagnosis = "Falha de comunicação";

            suggestedAction = "Verificar equipamento";

        }

        return new NeverCommunicatedResponse(

                vehicle.getPlate(),

                vehicle.getInsuredName(),

                linkage.getStartAt(),

                diagnosis,

                suggestedAction

        );

    }

}
