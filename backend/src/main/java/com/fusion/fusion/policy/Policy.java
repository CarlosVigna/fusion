package com.fusion.fusion.policy;

import com.fusion.fusion.vehicle.Vehicle;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

@Entity
@Table(name = "policies")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Policy {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "vehicle_id")
    private Vehicle vehicle;

    @Column(nullable = false)
    private String policyNumber;

    private LocalDate startDate;

    private LocalDate endDate;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private PolicyStatus status = PolicyStatus.ACTIVE;

    private String insuredName;

    private String cpfCnpj;

    private String vehicleModel;

    private String vehicleBrand;

    private Integer bonus;

    private String statusDescricao;

    private String plate;

    private LocalDate alertDismissedAt;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private PolicySource source = PolicySource.MANUAL;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    void prePersist() {
        createdAt = LocalDateTime.now(ZoneOffset.UTC);
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now(ZoneOffset.UTC);
    }

}
