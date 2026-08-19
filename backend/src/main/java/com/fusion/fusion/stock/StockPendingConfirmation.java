package com.fusion.fusion.stock;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.time.ZoneOffset;

// Criada quando um IMEI que esta no estoque de um tecnico (status
// EM_ESTOQUE) posiciona pela primeira vez numa placa — sinaliza que o
// equipamento provavelmente foi instalado, aguardando o tecnico
// confirmar a baixa manualmente (ou ignorar, se for falso positivo).
@Entity
@Table(name = "stock_pending_confirmation")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StockPendingConfirmation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "stock_id")
    private TechnicianStock stock;

    private String plate;

    private LocalDateTime detectedAt;

    @Builder.Default
    private boolean confirmed = false;

    private LocalDateTime confirmedAt;

    private String confirmedBy;

    @PrePersist
    void prePersist() {
        if (detectedAt == null) {
            detectedAt = LocalDateTime.now(ZoneOffset.UTC);
        }
    }

}
