package com.fusion.fusion.operational.snapshot;

import com.fusion.fusion.vehicle.OperationalStatus;
import com.fusion.fusion.vehicle.Vehicle;
import com.fusion.fusion.vehicle.operational.CommunicationStatus;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OperationalSnapshot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne
    private Vehicle vehicle;

    private Boolean online;

    private Integer batteryLevel;

    @Enumerated(EnumType.STRING)
    private CommunicationStatus communicationStatus;

    private Integer signalDelayMinutes;

    private Boolean staleUpdate;

    private Boolean lowBattery;

    @Enumerated(EnumType.STRING)
    private OperationalStatus operationalStatus;

    private LocalDateTime lastCommunicationAt;

    private LocalDateTime updatedAt;

}