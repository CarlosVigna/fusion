package com.fusion.fusion.occurrence.service;

import com.fusion.fusion.alert.OperationalAlert;
import com.fusion.fusion.alert.OperationalAlertType;
import com.fusion.fusion.occurrence.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class OccurrenceService {

    private final OccurrenceRepository repository;

    public void createFromAlert(
            OperationalAlert alert
    ) {

        Optional<Occurrence> existing =
                repository.findByAlert(alert);

        if (existing.isPresent()) {
            return;
        }

        String title =
                buildTitle(alert);

        String description =
                buildDescription(alert);

        Occurrence occurrence =
                Occurrence.builder()
                        .vehicle(alert.getVehicle())
                        .alert(alert)
                        .title(title)
                        .description(description)
                        .status(OccurrenceStatus.OPEN)
                        .createdAt(LocalDateTime.now())
                        .updatedAt(LocalDateTime.now())
                        .build();

        repository.save(occurrence);

    }

    private String buildTitle(
            OperationalAlert alert
    ) {

        return switch (alert.getType()) {

            case NO_COMMUNICATION ->
                    "Veículo sem comunicação";

            case COMMUNICATION_DELAY ->
                    "Comunicação atrasada";

            case LOW_BATTERY ->
                    "Bateria baixa";

            case STALE_UPDATE ->
                    "Atualização antiga";

        };

    }

    private String buildDescription(
            OperationalAlert alert
    ) {

        return """
                Veículo: %s
                
                Tipo alerta: %s
                
                Mensagem:
                %s
                """.formatted(
                alert.getVehicle().getPlate(),
                alert.getType(),
                alert.getMessage()
        );

    }

}