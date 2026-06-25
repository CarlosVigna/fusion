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

}