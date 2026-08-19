package com.fusion.fusion.stock;

import com.fusion.fusion.technician.Technician;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

@Entity
@Table(name = "technician_stock")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TechnicianStock {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "technician_id")
    private Technician technician;

    private String imei;

    private String iccid;

    private String chipLine;

    private String model;

    private LocalDate receivedAt;

    private LocalDate sentAt;

    private LocalDate installedAt;

    private String installedPlate;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private StockStatus status = StockStatus.EM_ESTOQUE;

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
