package com.fusion.fusion.letter;

import com.fusion.fusion.vehicle.Vehicle;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.ColumnDefault;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

@Entity
@Table(name = "letter_records")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LetterRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(nullable = false)
    private Vehicle vehicle;

    private String insuredName;

    private String base;

    private String modelo;

    private LocalDate ultimaPosicao;

    @Column(nullable = false)
    private LocalDate dataEnvio;

    private LocalDate fimVigencia;

    private String osAberta;

    private String dataRetornoSinal;

    private String operador;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private LetterStatus status = LetterStatus.ATIVA;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {

        createdAt = LocalDateTime.now(ZoneOffset.UTC);

        if (dataRetornoSinal == null || dataRetornoSinal.isBlank()) {
            dataRetornoSinal = "Sem retorno.";
        }

        if (status == null) {
            status = LetterStatus.ATIVA;
        }

    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now(ZoneOffset.UTC);
    }

}
