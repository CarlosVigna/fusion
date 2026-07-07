package com.fusion.fusion.installation;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;
import java.util.Optional;

public interface InstallationRepository
        extends JpaRepository<Installation, Long>, JpaSpecificationExecutor<Installation> {

    List<Installation> findAllByOrderByCreatedAtDesc();

    List<Installation> findByStatusOrderByCreatedAtDesc(InstallationStatus status);

    long countByStatus(InstallationStatus status);

    Optional<Installation> findByExternalId(String externalId);

}
