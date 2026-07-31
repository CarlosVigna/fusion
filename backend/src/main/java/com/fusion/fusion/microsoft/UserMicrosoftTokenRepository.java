package com.fusion.fusion.microsoft;

import com.fusion.fusion.user.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface UserMicrosoftTokenRepository extends JpaRepository<UserMicrosoftToken, UUID> {

    Optional<UserMicrosoftToken> findByUser(User user);

    void deleteByUser(User user);

}
