package com.fusion.fusion.installation;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface InstallationRepository
        extends JpaRepository<Installation, Long> {

    List<Installation> findAllByOrderByCreatedAtDesc();

    List<Installation> findByStatusOrderByCreatedAtDesc(InstallationStatus status);

    long countByStatus(InstallationStatus status);

}
