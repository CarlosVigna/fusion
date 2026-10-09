package com.fusion.fusion.installation;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Collection;
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

    List<Installation> findByStatusNotOrderByCreatedAtDesc(InstallationStatus status);

    List<Installation> findTop5ByStatusNotInOrderByClosedAtDesc(Collection<InstallationStatus> statuses);

    Optional<Installation> findByExternalId(String externalId);

    List<Installation> findByExternalIdIn(List<String> externalIds);

    Optional<Installation> findByPlateIgnoreCase(String plate);

    List<Installation> findByCreatedAtBeforeAndStatusNot(LocalDateTime date, InstallationStatus status);

    // TEMPORARIO — usados por DELETE /etl/diag/purge-before
    long countByCreatedAtBefore(LocalDateTime cutoff);

    @Modifying
    @Query("DELETE FROM Installation i WHERE i.createdAt < :cutoff")
    int purgeByCreatedAtBefore(@Param("cutoff") LocalDateTime cutoff);

}
