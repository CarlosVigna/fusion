package com.fusion.fusion.alert;

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
public class OperationalAlert {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    private Vehicle vehicle;

    @Enumerated(EnumType.STRING)
    private OperationalAlertType type;

    @Enumerated(EnumType.STRING)
    private OperationalAlertStatus status;

    private String message;

    private LocalDateTime openedAt;

    private LocalDateTime resolvedAt;

}