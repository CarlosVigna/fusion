package com.fusion.fusion.user;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<com.fusion.fusion.user.User, UUID> {

    Optional<com.fusion.fusion.user.User> findByEmail(String email);

    List<com.fusion.fusion.user.User> findAllByOrderByCreatedAtAsc();

}