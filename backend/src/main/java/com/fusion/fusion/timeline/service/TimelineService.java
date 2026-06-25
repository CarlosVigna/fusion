package com.fusion.fusion.timeline.service;

import com.fusion.fusion.occurrence.Occurrence;
import com.fusion.fusion.timeline.*;
import com.fusion.fusion.vehicle.Vehicle;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.ZoneOffset;

@Service
@RequiredArgsConstructor
public class TimelineService {

    private final TimelineEventRepository repository;

    public void register(
            Vehicle vehicle,
            Occurrence occurrence,
            TimelineEventType type,
            String description
    ) {

        TimelineEvent event =
                TimelineEvent.builder()
                        .vehicle(vehicle)
                        .occurrence(occurrence)
                        .type(type)
                        .description(description)
                        .createdAt(LocalDateTime.now(ZoneOffset.UTC))
                        .build();

        repository.save(event);

    }

}