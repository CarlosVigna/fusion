package com.fusion.fusion.importation;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "import_diff_log")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ImportDiffLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ImportType importType;

    // Veículos/dispositivos novos nesta atualização
    private int added;

    // Veículos removidos (soft-deleted) nesta atualização
    private int removed;

    // Registros alterados nesta atualização
    private int changed;

    private boolean dismissed;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    private LocalDateTime dismissedAt;

}
