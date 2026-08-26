package com.fusion.fusion.vehicle.portal;

import com.fusion.fusion.vehicle.Vehicle;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.time.ZoneOffset;

@Entity
@Table(name = "vehicle_portal_diffs")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VehiclePortalDiff {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "vehicle_id", nullable = false)
    private Vehicle vehicle;

    private String plate;

    @Column(nullable = false)
    private String field;

    private String currentValue;

    private String newValue;

    private LocalDateTime detectedAt;

    private LocalDateTime acceptedAt;

    private LocalDateTime rejectedAt;

    @PrePersist
    public void prePersist() {
        detectedAt = LocalDateTime.now(ZoneOffset.UTC);
    }

}
