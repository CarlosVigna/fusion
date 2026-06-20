package com.fusion.fusion.pendingchange;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "pending_changes")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PendingChange {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String vehiclePlate;

    private String fieldName;

    @Column(columnDefinition = "TEXT")
    private String oldValue;

    @Column(columnDefinition = "TEXT")
    private String newValue;

    private String sourceImport;

    private LocalDateTime detectedAt;

    @Builder.Default
    private String status = PendingChangeStatus.PENDING;

    private LocalDateTime resolvedAt;

    private String resolvedBy;

    @PrePersist
    public void prePersist() {
        detectedAt = LocalDateTime.now();
    }

}
