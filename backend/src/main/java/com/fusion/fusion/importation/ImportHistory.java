package com.fusion.fusion.importation;

import com.fusion.fusion.user.User;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

@Entity
@Table(name = "import_history")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ImportHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Enumerated(EnumType.STRING)
    private ImportType type;

    private String fileName;

    private Integer processedRecords;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private ImportStatus status = ImportStatus.SUCCESS;

    @ManyToOne
    private User importedBy;

    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        createdAt = LocalDateTime.now(ZoneOffset.UTC);
    }

}