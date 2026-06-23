package com.fusion.fusion.vehicle.operational;

import com.fusion.fusion.vehicle.Vehicle;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VehicleOperationalState {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    private Vehicle vehicle;

    private Boolean online;

    private Boolean ignition;

    private Double speed;

    private String address;

    private Integer batteryLevel;

    private Integer signalDelayMinutes;

    @Enumerated(EnumType.STRING)
    private CommunicationStatus communicationStatus;

    private LocalDateTime lastCommunicationAt;

    private LocalDateTime lastPositionAt;

    private LocalDateTime updatedAt;

}