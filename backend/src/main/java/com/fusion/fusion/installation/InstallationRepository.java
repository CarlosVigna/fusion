package com.fusion.fusion.installation;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

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

    Optional<Installation> findByExternalId(String externalId);

    Optional<Installation> findByPlateIgnoreCase(String plate);

    List<Installation> findByPortalStatus(String portalStatus);

    List<Installation> findByPortalStatusIn(Collection<String> portalStatuses);

    // Diagnostico (GET /installations/diagnostic/status-count) — contagem
    // real por portalStatus no banco, incluindo valores fora dos 8 oficiais
    // (ex.: o antigo "SAIU_DE_AGUARDANDO_AGENDAMENTO" ou null), pra
    // comparar com o que o portal mostra.
    @Query("SELECT i.portalStatus, COUNT(i) FROM Installation i GROUP BY i.portalStatus")
    List<Object[]> countGroupedByPortalStatus();

    // Varredura de orfaos (sync) — registros cujo externalId nao apareceu
    // em nenhuma das buscas do ciclo atual E que nao estao num status
    // terminal/ja-marcado. externalId nulo (instalacao criada manualmente,
    // sem vinculo com o portal) nunca cai aqui: "NOT IN" com coluna nula
    // nao bate (semantica padrao de NULL em SQL).
    List<Installation> findByPortalStatusNotInAndExternalIdNotIn(
            Collection<String> excludedStatuses, Collection<String> seenExternalIds
    );

}
