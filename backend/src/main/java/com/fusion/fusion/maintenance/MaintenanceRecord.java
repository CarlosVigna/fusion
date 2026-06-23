package com.fusion.fusion.maintenance;

import com.fusion.fusion.vehicle.Vehicle;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "maintenance_records")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MaintenanceRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(nullable = false)
    private Vehicle vehicle;

    private String insuredName;

    private String modelo;

    private String localPosicao;

    private String cidadeUf;

    @Column(nullable = false)
    private LocalDate data;

    @Column(nullable = false)
    private LocalDate prazoEncerramento;

    private String base;

    private String operador;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(nullable = false)
    private MaintenanceStatus status = MaintenanceStatus.ABERTO;

    private LocalDate dataEncerramento;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        createdAt = LocalDateTime.now();
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now();
    }

}
