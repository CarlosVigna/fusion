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

    // LAZY explicito — @OneToOne/@ManyToOne sao EAGER por padrao no
    // Hibernate, o que faz findAll() carregar a Vehicle associada de
    // cada linha com 1 query extra por linha (N+1 mascarado, so aparece
    // sob carga concorrente).
    @OneToOne(fetch = FetchType.LAZY)
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