package com.fusion.fusion.installation;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface InstallationObservationRepository extends JpaRepository<InstallationObservation, Long> {

    List<InstallationObservation> findByInstallationOrderByCreatedAtDesc(Installation installation);

    // TEMPORARIO — DELETE /etl/diag/purge-before. Observacoes tem FK pra
    // installations, entao precisam sair antes das instalacoes.
    @Modifying
    @Query("DELETE FROM InstallationObservation o WHERE o.installation.id IN "
            + "(SELECT i.id FROM Installation i WHERE i.createdAt < :cutoff)")
    int purgeByInstallationCreatedAtBefore(@Param("cutoff") LocalDateTime cutoff);

}
