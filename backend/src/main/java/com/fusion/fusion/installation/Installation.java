package com.fusion.fusion.installation;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.time.ZoneOffset;

@Entity
@Table(name = "installations")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Installation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true)
    private String externalId;

    private String customerName;

    private String address;

    private String neighborhood;

    private String city;

    private String state;

    private String zipCode;

    private String phone;

    private String plate;

    private String model;

    private Long numeroProposta;

    private LocalDateTime portalCreatedAt;

    private String serviceType;

    private String portalStatus;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(nullable = false)
    private InstallationStatus status = InstallationStatus.PENDING;

    private LocalDateTime sentAt;

    private String sentBy;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        createdAt = LocalDateTime.now(ZoneOffset.UTC);
        if (status == null) {
            status = InstallationStatus.PENDING;
        }
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now(ZoneOffset.UTC);
    }

}
