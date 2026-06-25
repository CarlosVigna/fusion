package com.fusion.fusion.preference;

import com.fusion.fusion.user.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserPreferenceRepository
        extends JpaRepository<UserPreference, Long> {

    Optional<UserPreference> findByUserAndKey(
            User user,
            String key
    );

}
