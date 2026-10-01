package com.fusion.fusion.vehicle.multiportal.linkage;

import com.fusion.fusion.vehicle.Vehicle;
import com.fusion.fusion.vehicle.multiportal.device.Device;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

@Entity
@Table(name = "device_linkages")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DeviceLinkage {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne
    private Vehicle vehicle;

    @ManyToOne
    private Device device;

    private LocalDateTime startAt;

    private LocalDateTime endAt;

    @Builder.Default
    private Boolean active = true;

    private String manufacturer;

    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        createdAt = LocalDateTime.now(ZoneOffset.UTC);
    }

    // Escolhe o vinculo mais recente entre dois pro MESMO veiculo —
    // usado em todo lugar que monta "1 vinculo ativo por veiculo" a
    // partir de findAllActiveWithVehicleAndDevice() (sem ORDER BY, a
    // ordem de retorno do Postgres nao e' garantida). Antes, esses
    // lugares pegavam so' o primeiro da iteracao (putIfAbsent/merge
    // com (a,b)->a) — se por engano existissem 2 vinculos active=true
    // pro mesmo veiculo (nao deveria acontecer, mas aconteceu com a
    // OGF5D31), qual dos dois "ganhava" era essencialmente aleatorio.
    // startAt e' a referencia principal (data real de inicio do
    // vinculo); createdAt so' entra quando startAt estiver nulo nos
    // dois, pra nao deixar o desempate sem criterio nenhum.
    public static DeviceLinkage pickMostRecent(DeviceLinkage a, DeviceLinkage b) {

        LocalDateTime keyA = a.getStartAt() != null ? a.getStartAt() : a.getCreatedAt();
        LocalDateTime keyB = b.getStartAt() != null ? b.getStartAt() : b.getCreatedAt();

        if (keyA == null) return b;
        if (keyB == null) return a;

        return keyA.isAfter(keyB) ? a : b;

    }

}