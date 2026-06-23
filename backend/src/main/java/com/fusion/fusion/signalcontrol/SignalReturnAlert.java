package com.fusion.fusion.signalcontrol;

import com.fusion.fusion.vehicle.Vehicle;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "signal_return_alerts")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SignalReturnAlert {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(nullable = false)
    private Vehicle vehicle;

    private LocalDateTime detectedAt;

    private Integer previousDelayMinutes;

    @Builder.Default
    @Column(nullable = false)
    private Boolean dismissed = false;

    private LocalDateTime dismissedAt;

    private String dismissedBy;

    @PrePersist
    public void prePersist() {
        detectedAt = LocalDateTime.now();
    }

}
