package com.fusion.fusion.serviceorder;

import com.fusion.fusion.technician.Technician;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

@Entity
@Table(name = "service_orders")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ServiceOrder {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(unique = true)
    private String externalInstallationId;

    private String requestedBy;

    private LocalDateTime requestedAt;

    private String plate;

    private String chassis;

    @Builder.Default
    private String equipment = "LUMINI";

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(nullable = false)
    private ServiceType serviceType = ServiceType.INSTALACAO;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "technician_id")
    private Technician technician;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(nullable = false)
    private SchedulingStatus schedulingStatus = SchedulingStatus.ABERTO;

    private LocalDate scheduledDate;
    private String scheduledTime;

    private String city;
    private String address;
    private String neighborhood;
    private String state;
    private String zipCode;
    private String customerName;
    private String customerPhone;

    private Double distanceKm;
    private String technicianAddress;
    private String clientAddress;
    private BigDecimal displacementValue;
    private BigDecimal serviceValue;
    private BigDecimal totalValue;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(nullable = false)
    private FinancialApprovalStatus financialApprovalStatus = FinancialApprovalStatus.PENDENTE;

    @Builder.Default
    @Column(nullable = false)
    private Boolean completionConfirmed = false;

    @Builder.Default
    @Column(nullable = false)
    private Boolean completionAlertSent = false;

    @Column(columnDefinition = "TEXT")
    private String observations;

    private String createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime closedAt;
    private LocalDateTime scheduledAt;

    @Builder.Default
    @Column(name = "completed_without_signal", nullable = false,
            columnDefinition = "BOOLEAN NOT NULL DEFAULT FALSE")
    private Boolean completedWithoutSignal = false;

    @PrePersist
    public void prePersist() {
        createdAt = LocalDateTime.now(ZoneOffset.UTC);
        if (requestedAt == null) requestedAt = createdAt;
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now(ZoneOffset.UTC);
    }

    @Transient
    public long getSlaDays() {
        if (requestedAt == null) return 0;
        LocalDateTime end = closedAt != null ? closedAt : LocalDateTime.now(ZoneOffset.UTC);
        return ChronoUnit.DAYS.between(requestedAt.toLocalDate(), end.toLocalDate());
    }

    @Transient
    public boolean isLate() {
        return schedulingStatus != SchedulingStatus.CONCLUIDO && getSlaDays() > 3;
    }
}
