package com.fusion.fusion.vehicle;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

@Entity
@Table(name = "vehicles")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder

public class Vehicle {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true)
    private String plate;

    private String insuredName;

    @Enumerated(EnumType.STRING)
    private VehiclePlatform platform;

    private String partnership;

    private String policy;

    private String broker;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Builder.Default
    private Boolean inMaintenance = false;

    @Column(columnDefinition = "TEXT")
    private String maintenanceNotes;

    private String maintenanceOperator;

    @Builder.Default
    private Boolean active = true;

    // true na primeira vez que o veiculo aparece numa planilha de Ultima
    // Posicao com posicao preenchida — nunca volta para false. Usado para
    // distinguir "atrasado" (ja comunicou, sinal sumiu) de "nunca
    // comunicou" (linkage existe mas device nunca respondeu).
    @Builder.Default
    @Column(nullable = false)
    private Boolean hasEverCommunicated = false;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private LocalDateTime deletedAt;

    @PrePersist
    public void prePersist() {
        createdAt = LocalDateTime.now(ZoneOffset.UTC);
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now(ZoneOffset.UTC);
    }

}