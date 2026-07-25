package com.fusion.fusion.installation;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface InstallationRepository
        extends JpaRepository<Installation, Long>, JpaSpecificationExecutor<Installation> {

    List<Installation> findAllByOrderByCreatedAtDesc();

    List<Installation> findByStatusOrderByCreatedAtDesc(InstallationStatus status);

    List<Installation> findByStatusNotOrderByClosedAtDesc(InstallationStatus status);

    long countByStatus(InstallationStatus status);

    long countByStatusAndClosedAtBetween(InstallationStatus status, LocalDateTime from, LocalDateTime to);

    List<Installation> findTop5ByStatusNotOrderByClosedAtDesc(InstallationStatus status);

    Optional<Installation> findByExternalId(String externalId);

}
