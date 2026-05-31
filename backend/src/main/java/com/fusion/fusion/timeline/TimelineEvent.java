package com.fusion.fusion.timeline;

import com.fusion.fusion.occurrence.Occurrence;
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
public class TimelineEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    private Vehicle vehicle;

    @ManyToOne
    private Occurrence occurrence;

    @Enumerated(EnumType.STRING)
    private TimelineEventType type;

    @Column(length = 5000)
    private String description;

    private LocalDateTime createdAt;

}