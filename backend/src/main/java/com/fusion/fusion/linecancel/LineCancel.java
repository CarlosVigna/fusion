package com.fusion.fusion.linecancel;

import com.fusion.fusion.vehicle.Vehicle;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

// Controle de cancelamento de linha de chip pra veiculos cuja apolice
// foi cancelada/encerrada — ver LineCancelService.syncFromPolicies()
// pra como/quando um registro e' criado.
@Entity
@Table(name = "line_cancels")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LineCancel {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    private Vehicle vehicle;

    private String plate;

    private String insuredName;

    // Serial Chip 1 do dispositivo (DeviceLinkage ativa no momento do sync).
    private String iccid;

    // Linha do chip (Device.lineNumber).
    private String msisdn;

    // IMEI do dispositivo.
    private String imei;

    // Data de cancelamento/encerramento da apolice que originou este registro.
    private LocalDate policyEndDate;

    // Status da apolice (CANCELLED ou CLOSED) no momento do sync.
    private String policyStatus;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private LineCancelStatus status = LineCancelStatus.AGUARDANDO;

    private LocalDate verifiedAt;

    private String verifiedBy;

    private LocalDate requestedAt;

    private String requestedBy;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        createdAt = LocalDateTime.now(ZoneOffset.UTC);
        updatedAt = createdAt;
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now(ZoneOffset.UTC);
    }

}
