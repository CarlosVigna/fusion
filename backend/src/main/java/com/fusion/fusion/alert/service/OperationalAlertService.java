package com.fusion.fusion.alert.service;

import com.fusion.fusion.alert.OperationalAlert;
import com.fusion.fusion.alert.OperationalAlertRepository;
import com.fusion.fusion.alert.OperationalAlertStatus;
import com.fusion.fusion.alert.OperationalAlertType;
import com.fusion.fusion.occurrence.service.OccurrenceService;
import com.fusion.fusion.realtime.DashboardRealtimeService;
import com.fusion.fusion.timeline.TimelineEventType;
import com.fusion.fusion.timeline.service.TimelineService;
import com.fusion.fusion.vehicle.Vehicle;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class OperationalAlertService {

    private final OccurrenceService occurrenceService;

    private final TimelineService timelineService;

    private final DashboardRealtimeService realtimeService;

    private final OperationalAlertRepository repository;

    // Junta o save do alerta, o publish do dashboard, o registro na
    // timeline e a criacao da ocorrencia em 1 unico commit em vez de 4+
    // round trips separados para o Neon.
    @Transactional
    public void openAlert(

            Vehicle vehicle,

            OperationalAlertType type,

            String message

    ) {

        Optional<OperationalAlert> existing =
                repository.findByVehicleAndTypeAndStatus(
                        vehicle,
                        type,
                        OperationalAlertStatus.OPEN
                );

        if (existing.isPresent()) {

            return;

        }

        log.warn(
                "Abrindo alerta {} para veículo {}",
                type,
                vehicle.getPlate()
        );

        OperationalAlert alert =
                OperationalAlert.builder()
                        .vehicle(vehicle)
                        .type(type)
                        .status(
                                OperationalAlertStatus.OPEN
                        )
                        .message(message)
                        .openedAt(LocalDateTime.now())
                        .build();

        repository.save(alert);

        realtimeService.publish(
                "ALERT_OPENED",
                vehicle.getPlate()
                        + " - "
                        + message
        );

        timelineService.register(
                vehicle,
                null,
                TimelineEventType.ALERT_OPENED,
                message
        );

        occurrenceService.createFromAlert(alert);

    }

    @Transactional
    public void resolveAlert(
            Vehicle vehicle,
            OperationalAlertType type
    ) {

        Optional<OperationalAlert> existing =
                repository.findByVehicleAndTypeAndStatus(
                        vehicle,
                        type,
                        OperationalAlertStatus.OPEN
                );

        if (existing.isEmpty()) {
            return;
        }

        OperationalAlert alert =
                existing.get();

        alert.setStatus(
                OperationalAlertStatus.RESOLVED
        );

        alert.setResolvedAt(
                LocalDateTime.now()
        );

        repository.save(alert);

        realtimeService.publish(
                "ALERT_RESOLVED",
                vehicle.getPlate()
                        + " - alerta resolvido"
        );

        timelineService.register(
                vehicle,
                null,
                TimelineEventType.ALERT_RESOLVED,
                "Alerta resolvido automaticamente"
        );

    }

}