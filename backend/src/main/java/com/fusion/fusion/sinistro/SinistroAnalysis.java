package com.fusion.fusion.sinistro;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

@Entity
@Table(name = "sinistro_analyses")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SinistroAnalysis {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String plate;

    private String insuredName;

    @Column(nullable = false)
    private LocalDate startDate;

    @Column(nullable = false)
    private LocalDate endDate;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private SinistroStatus status = SinistroStatus.PENDING;

    @Column(columnDefinition = "TEXT")
    private String kmData;

    @Column(columnDefinition = "TEXT")
    private String speedData;

    @Column(columnDefinition = "TEXT")
    private String indicators;

    @Column(columnDefinition = "TEXT")
    private String report;

    @Column(columnDefinition = "TEXT")
    private String errorMessage;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private String createdBy;

    @PrePersist
    public void prePersist() {
        createdAt = LocalDateTime.now(ZoneOffset.UTC);
        if (status == null) {
            status = SinistroStatus.PENDING;
        }
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now(ZoneOffset.UTC);
    }

}
