package com.fusion.fusion.occurrence;

import com.fusion.fusion.alert.OperationalAlert;
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
public class Occurrence {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    private Vehicle vehicle;

    @OneToOne
    private OperationalAlert alert;

    private String title;

    @Column(length = 5000)
    private String description;

    @Enumerated(EnumType.STRING)
    private OccurrenceStatus status;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

}