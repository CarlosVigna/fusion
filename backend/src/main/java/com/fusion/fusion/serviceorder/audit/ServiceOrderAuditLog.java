package com.fusion.fusion.serviceorder.audit;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

@Entity
@Table(name = "service_order_audit_log")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ServiceOrderAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private String plate;

    private UUID serviceOrderId;

    // CRIADA, EDITADA, AGENDADA, APROVADA, REPROVADA, CONCLUIDA, EXCLUIDA
    private String action;

    private String field;

    @Column(columnDefinition = "TEXT")
    private String oldValue;

    @Column(columnDefinition = "TEXT")
    private String newValue;

    private String performedBy;

    private String performedByName;

    private LocalDateTime performedAt;

    @PrePersist
    public void prePersist() {
        if (performedAt == null) performedAt = LocalDateTime.now(ZoneOffset.UTC);
    }
}
