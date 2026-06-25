package com.fusion.fusion.preference;

import com.fusion.fusion.user.User;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.time.ZoneOffset;

@Entity
@Table(
        name = "user_preferences",
        uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "preference_key"})
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserPreference {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "preference_key", nullable = false)
    private String key;

    @Column(columnDefinition = "TEXT")
    private String value;

    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    public void touchUpdatedAt() {
        updatedAt = LocalDateTime.now(ZoneOffset.UTC);
    }

}
